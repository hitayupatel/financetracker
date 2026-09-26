"""PDF statement import for Finance Minister.

Parses PDF statements from Chase, Discover, Capital One, Marcus, Robinhood, Fidelity, Webull.
"""

import re
import io
from datetime import datetime, date
from typing import Optional

import pdfplumber

from src.config import load_config
from src.database import get_session, Transaction, Account, is_duplicate_transaction
from src.categorizer import categorize_transaction, categorize_by_keywords


def _parse_date(date_str: str, year_hint: Optional[int] = None) -> Optional[date]:
    date_str = date_str.strip()
    formats_with_year = ["%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%b %d, %Y", "%B %d, %Y"]
    formats_without_year = ["%m/%d", "%b %d", "%B %d"]

    for fmt in formats_with_year:
        try:
            return datetime.strptime(date_str, fmt).date()
        except (ValueError, TypeError):
            continue

    for fmt in formats_without_year:
        try:
            d = datetime.strptime(date_str, fmt)
            year = year_hint or date.today().year
            return d.replace(year=year).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_amount(amount_str: str) -> Optional[float]:
    if not amount_str:
        return None
    cleaned = amount_str.replace("$", "").replace(",", "").replace(" ", "").strip()
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    cleaned = cleaned.replace("CR", "").replace("DR", "").strip()
    if cleaned.endswith("-"):
        cleaned = "-" + cleaned[:-1]
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _extract_year_from_text(text: str) -> Optional[int]:
    patterns = [
        r"(?:Statement\s+(?:Period|Date|Closing Date)[:\s]*.*?(\d{4}))",
        r"(\d{1,2}/\d{1,2}/(\d{4}))",
        r"(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            year_str = match.group(match.lastindex)
            try:
                year = int(year_str)
                if 2000 <= year <= 2100:
                    return year
            except (ValueError, TypeError):
                continue
    return None


def _parse_chase_credit(text, year_hint):
    transactions = []
    pattern = r"(\d{2}/\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"
    for line in text.split("\n"):
        match = re.match(pattern, line.strip())
        if match:
            date_str, description, amount_str = match.groups()
            parsed_date = _parse_date(date_str, year_hint)
            amount = _parse_amount(amount_str)
            if parsed_date and amount is not None:
                txn_type = "payment" if amount < 0 else "expense"
                transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": txn_type})
    return transactions


def _parse_chase_checking(text, year_hint):
    transactions = []
    # Chase checking lines can be either:
    #   (a) date  description  amount  balance   <- two trailing numbers
    #   (b) date  description  amount             <- single trailing number
    # We must capture the AMOUNT, not the running balance. Try (a) first so the
    # trailing balance column isn't mistaken for the amount.
    pattern_amt_bal = r"(\d{2}/\d{2})\s+(.+?)\s+(-?[\$]?[\d,]+\.\d{2})\s+(-?[\$]?[\d,]+\.\d{2})\s*$"
    pattern_amt = r"(\d{2}/\d{2})\s+(.+?)\s+(-?[\$]?[\d,]+\.\d{2})\s*$"
    for line in text.split("\n"):
        line = line.strip()
        m = re.match(pattern_amt_bal, line)
        if m:
            date_str, description, amount_str, _balance_str = m.groups()
        else:
            m = re.match(pattern_amt, line)
            if not m:
                continue
            date_str, description, amount_str = m.groups()
        parsed_date = _parse_date(date_str, year_hint)
        amount = _parse_amount(amount_str)
        if parsed_date and amount is not None:
            txn_type = "income" if amount > 0 else "expense"
            transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": txn_type})
    return transactions


def _parse_discover(text, year_hint):
    transactions = []
    pattern = r"(\d{2}/\d{2})\s+\d{2}/\d{2}\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"
    for line in text.split("\n"):
        match = re.match(pattern, line.strip())
        if match:
            date_str, description, amount_str = match.groups()
            parsed_date = _parse_date(date_str, year_hint)
            amount = _parse_amount(amount_str)
            if parsed_date and amount is not None:
                transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": "payment" if amount < 0 else "expense"})
    if not transactions:
        pattern2 = r"(\d{2}/\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"
        for line in text.split("\n"):
            match = re.match(pattern2, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": "payment" if amount < 0 else "expense"})
    return transactions


def _parse_capital_one(text, year_hint):
    transactions = []
    patterns = [
        r"([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$",
        r"(\d{2}/\d{2}(?:/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$",
    ]
    for pattern in patterns:
        for line in text.split("\n"):
            match = re.match(pattern, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": "payment" if amount < 0 else "expense"})
        if transactions:
            break
    return transactions


def _parse_marcus(text, year_hint):
    transactions = []
    pattern = r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"
    for line in text.split("\n"):
        match = re.match(pattern, line.strip())
        if match:
            date_str, description, amount_str = match.groups()
            parsed_date = _parse_date(date_str, year_hint)
            amount = _parse_amount(amount_str)
            if parsed_date and amount is not None:
                txn_type = "income" if amount > 0 or "interest" in description.lower() else "expense"
                transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": txn_type})
    return transactions


def _parse_robinhood(text, year_hint):
    transactions = []
    div_pattern = r"(\d{2}/\d{2}/\d{4})\s+(Dividend|Interest)\s+(.+?)\s+\$?([\d,]+\.\d{2})"
    for match in re.finditer(div_pattern, text, re.IGNORECASE):
        date_str, activity, description, amount_str = match.groups()
        parsed_date = _parse_date(date_str, year_hint)
        amount = _parse_amount(amount_str)
        if parsed_date and amount:
            transactions.append({"date": parsed_date, "description": f"{activity}: {description.strip()}", "amount": amount, "type": "income"})

    trade_pattern = r"(\d{2}/\d{2}/\d{4})\s+(Buy|Sell)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})"
    for match in re.finditer(trade_pattern, text, re.IGNORECASE):
        date_str, action, description, amount_str = match.groups()
        parsed_date = _parse_date(date_str, year_hint)
        amount = _parse_amount(amount_str)
        if parsed_date and amount:
            txn_type = "investment" if action.lower() == "buy" else "income"
            transactions.append({"date": parsed_date, "description": f"{action}: {description.strip()}", "amount": abs(amount), "type": txn_type})

    if not transactions:
        pattern = r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"
        for line in text.split("\n"):
            match = re.match(pattern, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": "investment"})
    return transactions


def _parse_fidelity(text, year_hint):
    transactions = []
    patterns = [r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$", r"(\d{2}/\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"]
    income_kw = ["dividend", "interest", "distribution", "credit"]
    invest_kw = ["bought", "buy", "purchased", "contribution", "reinvest"]

    for pattern in patterns:
        for line in text.split("\n"):
            match = re.match(pattern, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    dl = description.lower()
                    if any(k in dl for k in income_kw):
                        txn_type = "income"
                    elif any(k in dl for k in invest_kw):
                        txn_type = "investment"
                    else:
                        txn_type = "investment" if amount > 0 else "expense"
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": txn_type})
        if transactions:
            break
    return transactions


def _parse_webull(text, year_hint):
    transactions = []
    patterns = [r"(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$", r"(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$"]
    for pattern in patterns:
        for line in text.split("\n"):
            match = re.match(pattern, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    dl = description.lower()
                    if "dividend" in dl or "interest" in dl:
                        txn_type = "income"
                    elif "buy" in dl:
                        txn_type = "investment"
                    elif "sell" in dl:
                        txn_type = "income"
                    else:
                        txn_type = "investment"
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": txn_type})
        if transactions:
            break
    return transactions


def _parse_generic(text, year_hint):
    transactions = []
    # Each pattern captures: date, description, amount, and an OPTIONAL trailing
    # balance column. When a balance is present we still use the first number
    # (the amount) — never the running balance.
    date_res = [r"\d{2}/\d{2}/\d{4}", r"\d{2}/\d{2}", r"\d{4}-\d{2}-\d{2}"]
    num = r"-?\$?[\d,]+\.\d{2}"
    for date_re in date_res:
        pattern = rf"({date_re})\s+(.+?)\s+({num})(?:\s+{num})?\s*$"
        for line in text.split("\n"):
            match = re.match(pattern, line.strip())
            if match:
                date_str, description, amount_str = match.groups()
                parsed_date = _parse_date(date_str, year_hint)
                amount = _parse_amount(amount_str)
                if parsed_date and amount is not None:
                    transactions.append({"date": parsed_date, "description": description.strip(), "amount": abs(amount), "type": "expense" if amount > 0 else "income"})
        if transactions:
            break
    return transactions


INSTITUTION_MARKERS = {
    "chase_credit": ["JPMorgan Chase", "CHASE CREDIT", "Card Summary", "Payment Due Date"],
    "chase_checking": ["JPMorgan Chase", "CHECKING SUMMARY", "Deposits and Additions"],
    "discover": ["Discover", "DFS SERVICES", "Discover Financial"],
    "capital_one": ["Capital One", "CapitalOne", "CAPITAL ONE"],
    "marcus": ["Marcus", "Goldman Sachs", "Marcus by Goldman Sachs"],
    "robinhood": ["Robinhood", "ROBINHOOD SECURITIES", "Robinhood Markets"],
    "fidelity": ["Fidelity", "FIDELITY INVESTMENTS", "Fidelity Brokerage"],
    "webull": ["Webull", "WEBULL FINANCIAL", "Webull Securities"],
}

PARSERS = {
    "chase_credit": _parse_chase_credit,
    "chase_checking": _parse_chase_checking,
    "discover": _parse_discover,
    "capital_one": _parse_capital_one,
    "marcus": _parse_marcus,
    "robinhood": _parse_robinhood,
    "fidelity": _parse_fidelity,
    "webull": _parse_webull,
    "generic": _parse_generic,
}


def detect_institution(text: str) -> str:
    text_upper = text[:3000].upper()
    scores = {}
    for institution, markers in INSTITUTION_MARKERS.items():
        score = sum(1 for m in markers if m.upper() in text_upper)
        if score > 0:
            scores[institution] = score
    if not scores:
        return "generic"
    if "chase_credit" in scores and "chase_checking" in scores:
        if "CREDIT" in text_upper or "CARD SUMMARY" in text_upper:
            return "chase_credit"
        return "chase_checking"
    return max(scores, key=scores.get)


def extract_text_from_pdf(file_content: bytes) -> str:
    text_pages = []
    with pdfplumber.open(io.BytesIO(file_content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_pages.append(page_text)
    return "\n".join(text_pages)


def preview_pdf(file_content: bytes) -> dict:
    try:
        text = extract_text_from_pdf(file_content)
    except Exception as e:
        return {"error": f"Could not read PDF: {str(e)}"}
    if not text.strip():
        return {"error": "PDF appears empty or image-based (no extractable text)."}

    institution = detect_institution(text)
    year_hint = _extract_year_from_text(text) or date.today().year
    parser = PARSERS.get(institution, _parse_generic)
    transactions = parser(text, year_hint)

    return {
        "institution": institution,
        "institution_display": institution.replace("_", " ").title(),
        "year": year_hint,
        "total_found": len(transactions),
        "sample_transactions": transactions[:10],
        "raw_text_preview": text[:1000],
    }


def import_pdf(file_content: bytes, account_id: int, institution: Optional[str] = None, default_type: str = "expense") -> dict:
    try:
        text = extract_text_from_pdf(file_content)
    except Exception as e:
        return {"success": False, "error": f"Could not read PDF: {str(e)}"}
    if not text.strip():
        return {"success": False, "error": "PDF appears empty or image-based."}

    detected = institution or detect_institution(text)
    year_hint = _extract_year_from_text(text) or date.today().year
    parser = PARSERS.get(detected, _parse_generic)
    transactions = parser(text, year_hint)

    if not transactions:
        return {"success": False, "error": f"Could not parse transactions (detected: {detected}). Try CSV."}

    session = get_session()
    imported = 0
    skipped = 0
    errors = []

    for txn in transactions:
        try:
            # Skip duplicates
            if is_duplicate_transaction(session, account_id, txn["date"], txn["amount"], txn["description"]):
                skipped += 1
                continue

            # Fast keyword-only pass during import; LLM runs in the background.
            category_id = categorize_by_keywords(txn["description"])
            db_txn = Transaction(
                date=txn["date"],
                amount=txn["amount"],
                transaction_type=txn.get("type", default_type),
                description=txn["description"],
                account_id=account_id,
                category_id=category_id,
                source="pdf_import",
            )
            session.add(db_txn)
            imported += 1
        except Exception as e:
            skipped += 1
            errors.append(str(e))

    if imported > 0:
        session.commit()
        session.close()
        from src.accounts import recalculate_balance
        recalculate_balance(account_id)

        import threading
        threading.Thread(target=_llm_categorize_background, args=(account_id,), daemon=True).start()
    else:
        session.close()

    return {"success": True, "imported": imported, "skipped": skipped, "errors": errors[:10], "total_parsed": len(transactions), "institution": detected.replace("_", " ").title()}


def _llm_categorize_background(account_id: int):
    """Run LLM categorization for uncategorized txns in a background thread,
    reporting live progress through the shared job tracker so the UI panel
    shows 'Categorizing X/Y'. 100% local via Ollama."""
    import re
    import requests
    from datetime import datetime

    from src.database import get_session, Transaction, Category, JobRun
    from src.config import get_llm_config
    from src.job_tracker import reset_status, update_progress, mark_done, add_failed

    session = get_session()
    try:
        uncategorized = (
            session.query(Transaction)
            .filter(
                Transaction.account_id == account_id,
                Transaction.category_id == None,  # noqa: E711
                Transaction.description != None,  # noqa: E711
            )
            .all()
        )
        if not uncategorized:
            mark_done()
            return

        config = get_llm_config()
        reset_status("import", len(uncategorized))

        job_run = JobRun(
            source="import",
            scope="uncategorized",
            total=len(uncategorized),
            model=config.get("model"),
            started_at=datetime.utcnow(),
        )
        session.add(job_run)
        session.commit()
        job_run_id = job_run.id

        all_cats = session.query(Category).all()
        cat_names = [c.name for c in all_cats]
        cat_map = {c.name.lower(): c.id for c in all_cats}

        batch_size = 15
        updated = 0
        failed = 0

        for i in range(0, len(uncategorized), batch_size):
            batch = uncategorized[i:i + batch_size]
            descriptions = [t.description for t in batch]
            numbered = "\n".join(f"{j+1}. {d}" for j, d in enumerate(descriptions))
            batch_matched = [False] * len(batch)

            prompt = f"""Categorize each transaction into one of these categories:
{', '.join(cat_names)}

Transactions:
{numbered}

Reply with ONLY the number and category, one per line. Example:
1. Dining
2. Groceries"""

            try:
                response = requests.post(
                    f"{config['base_url']}/api/generate",
                    json={
                        "model": config["model"],
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.1, "num_predict": 400},
                    },
                    timeout=60,
                )
                if response.status_code == 200:
                    answer = response.json().get("response", "")
                    for line in answer.strip().split("\n"):
                        line = line.strip()
                        if not line:
                            continue
                        m = re.match(r"^\s*(\d+)\s*[.):-]\s*(.+)$", line)
                        if not m:
                            continue
                        try:
                            idx = int(m.group(1)) - 1
                            raw_cat = m.group(2).strip().rstrip(".").strip()
                            cat_lower = raw_cat.lower()
                            matched_id = None
                            if cat_lower in cat_map:
                                matched_id = cat_map[cat_lower]
                            else:
                                for cname_lower, cid in cat_map.items():
                                    if cname_lower in cat_lower or cat_lower in cname_lower:
                                        matched_id = cid
                                        break
                            if matched_id and 0 <= idx < len(batch):
                                batch[idx].category_id = matched_id
                                batch_matched[idx] = True
                                updated += 1
                        except (ValueError, IndexError):
                            continue
            except Exception:
                pass

            for j, matched in enumerate(batch_matched):
                if not matched:
                    failed += 1
                    add_failed(batch[j].description or "(no description)", batch[j].amount)

            session.commit()
            update_progress(min(i + batch_size, len(uncategorized)), updated, failed)

        jr = session.query(JobRun).filter(JobRun.id == job_run_id).first()
        if jr:
            jr.updated = updated
            jr.failed = failed
            jr.finished_at = datetime.utcnow()
        session.commit()
    finally:
        session.close()
        mark_done()
