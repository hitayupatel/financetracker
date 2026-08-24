"""CSV import for bank and credit card statements."""

from datetime import datetime, date
from typing import Optional
import io

import pandas as pd

from src.config import load_config
from src.database import get_session, Transaction, Account, is_duplicate_transaction
from src.categorizer import categorize_transaction


COLUMN_MAPPINGS = {
    "date": ["date", "transaction date", "txn date", "posting date", "value date", "trans date"],
    "description": ["description", "narration", "particulars", "details", "transaction details", "remarks", "narrative", "memo"],
    "amount": ["amount", "transaction amount", "txn amount"],
    "debit": ["debit", "withdrawal", "dr", "debit amount", "withdrawals"],
    "credit": ["credit", "deposit", "cr", "credit amount", "deposits"],
    "balance": ["balance", "closing balance", "running balance", "available balance"],
}


def _normalize_columns(df):
    df.columns = [col.strip().lower() for col in df.columns]
    renamed = {}
    for standard_name, aliases in COLUMN_MAPPINGS.items():
        for alias in aliases:
            if alias in df.columns and standard_name not in renamed.values():
                renamed[alias] = standard_name
                break
    df = df.rename(columns=renamed)
    return df


def _parse_date(date_str):
    config = load_config()
    formats = config["csv_import"]["date_formats"]
    if isinstance(date_str, (datetime, date)):
        return date_str if isinstance(date_str, date) else date_str.date()
    date_str = str(date_str).strip()
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_amount(value):
    if pd.isna(value) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(",", "").replace("$", "").replace(" ", "").strip()
    if not cleaned or cleaned == "-":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


# Mapping from bank-provided category names to our internal category names
CSV_CATEGORY_MAP = {
    # Capital One categories
    "dining": "Dining",
    "merchandise": "Shopping",
    "gas/automotive": "Transport",
    "entertainment": "Entertainment",
    "phone/cable": "Utilities",
    "other services": "Personal Care",
    "other travel": "Transport",
    "airfare": "Travel",
    "insurance": "Insurance",
    "health care": "Healthcare",
    "internet": "Utilities",
    "utilities": "Utilities",
    "fee/interest charge": "Other Expense",
    "payment/credit": None,  # Skip — handled by income/expense logic
    # Chase categories (Type column)
    "ach_credit": None,
    "ach_debit": None,
    "quickpay_credit": None,
    "quickpay_debit": None,
}


def _map_csv_category(csv_category: str) -> "Optional[int]":
    """Map a bank-provided category name to our internal category_id."""
    from src.database import get_session, Category

    mapped_name = CSV_CATEGORY_MAP.get(csv_category.lower())
    if mapped_name is None:
        return None

    session = get_session()
    category = session.query(Category).filter(Category.name == mapped_name).first()
    session.close()
    return category.id if category else None


def preview_csv(file_content: bytes, encoding: str = "utf-8") -> dict:
    try:
        df = pd.read_csv(io.BytesIO(file_content), encoding=encoding, nrows=100, index_col=False)
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(io.BytesIO(file_content), encoding="latin-1", nrows=100, index_col=False)
        except Exception as e:
            return {"error": f"Could not read CSV: {str(e)}"}
    except Exception as e:
        return {"error": f"Could not read CSV: {str(e)}"}

    df = _normalize_columns(df)
    detected = {
        "has_date": "date" in df.columns,
        "has_description": "description" in df.columns,
        "has_amount": "amount" in df.columns,
        "has_debit_credit": "debit" in df.columns or "credit" in df.columns,
    }
    return {
        "columns": list(df.columns),
        "rows": df.head(5).to_dict(orient="records"),
        "row_count": len(df),
        "detected_format": detected,
    }


def import_csv(
    file_content: bytes,
    account_id: int,
    default_type: str = "expense",
    encoding: str = "utf-8",
    date_column: Optional[str] = None,
    description_column: Optional[str] = None,
    amount_column: Optional[str] = None,
    debit_column: Optional[str] = None,
    credit_column: Optional[str] = None,
    amount_sign_rule: Optional[str] = None,
) -> dict:
    try:
        df = pd.read_csv(io.BytesIO(file_content), encoding=encoding, index_col=False)
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(io.BytesIO(file_content), encoding="latin-1", index_col=False)
        except Exception as e:
            return {"success": False, "error": f"Could not read CSV: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Could not read CSV: {str(e)}"}

    df = _normalize_columns(df)

    date_col = date_column or ("date" if "date" in df.columns else None)
    desc_col = description_column or ("description" if "description" in df.columns else None)
    amount_col = amount_column or ("amount" if "amount" in df.columns else None)
    debit_col = debit_column or ("debit" if "debit" in df.columns else None)
    credit_col = credit_column or ("credit" if "credit" in df.columns else None)

    if not date_col:
        return {"success": False, "error": "No date column found."}
    if not amount_col and not (debit_col or credit_col):
        return {"success": False, "error": "No amount/debit/credit column found."}

    session = get_session()
    imported = 0
    skipped = 0
    errors = []

    for idx, row in df.iterrows():
        parsed_date = _parse_date(row.get(date_col))
        if not parsed_date:
            skipped += 1
            continue

        txn_type = default_type
        amount = None

        if amount_col and amount_col in df.columns:
            amount = _parse_amount(row.get(amount_col))
            if amount is not None:
                if amount_sign_rule == "All values are Expenses":
                    txn_type = "expense"
                    amount = abs(amount)
                elif amount_sign_rule == "All values are Income":
                    txn_type = "income"
                    amount = abs(amount)
                elif amount_sign_rule == "Positive = Expense, Negative = Income":
                    if amount >= 0:
                        txn_type = "expense"
                    else:
                        txn_type = "income"
                    amount = abs(amount)
                else:
                    # Default: Negative = Expense, Positive = Income
                    if amount < 0:
                        txn_type = "expense"
                    else:
                        txn_type = "income"
                    amount = abs(amount)
        elif debit_col or credit_col:
            debit_amt = _parse_amount(row.get(debit_col)) if debit_col else None
            credit_amt = _parse_amount(row.get(credit_col)) if credit_col else None
            if debit_amt is not None and debit_amt > 0:
                amount = debit_amt
                txn_type = "expense"
            elif credit_amt is not None and credit_amt > 0:
                amount = credit_amt
                txn_type = "income"
            elif debit_amt is not None:
                amount = abs(debit_amt)
                txn_type = "expense"
            elif credit_amt is not None:
                amount = abs(credit_amt)
                txn_type = "income"

        if amount is None:
            skipped += 1
            continue

        description = str(row.get(desc_col, "")).strip() if desc_col else ""

        # Skip duplicates
        if is_duplicate_transaction(session, account_id, parsed_date, amount, description):
            skipped += 1
            continue

        # Categorize: use CSV's own category column first, then fall back to keywords/LLM
        category_id = None
        csv_category = str(row.get("category", "")).strip() if "category" in df.columns else ""
        if csv_category and csv_category.lower() != "nan":
            category_id = _map_csv_category(csv_category)
        if category_id is None:
            category_id = categorize_transaction(description)

        txn = Transaction(
            date=parsed_date,
            amount=amount,
            transaction_type=txn_type,
            description=description if description else None,
            account_id=account_id,
            category_id=category_id,
            source="csv_import",
        )
        session.add(txn)
        imported += 1

    if imported > 0:
        session.commit()
        _llm_categorize_uncategorized(session, account_id)
        from src.accounts import recalculate_balance
        session.close()
        recalculate_balance(account_id)
    else:
        session.close()

    return {
        "success": True,
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:10],
        "total_rows": len(df),
    }


def _llm_categorize_uncategorized(session, account_id: int):
    from src.categorizer import categorize_batch_llm

    uncategorized = (
        session.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.category_id == None,
            Transaction.description != None,
        )
        .all()
    )
    if not uncategorized:
        return

    descriptions = [t.description for t in uncategorized if t.description]
    if not descriptions:
        return

    results = categorize_batch_llm(descriptions)
    for txn in uncategorized:
        if txn.description and txn.description in results:
            txn.category_id = results[txn.description]
    session.commit()
