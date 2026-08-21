"""Transaction management for Finance Minister."""

from datetime import date, datetime
from typing import Optional

from sqlalchemy import func, extract

from src.database import get_session, Transaction, Category, Account


def add_transaction(
    date_val: date,
    amount: float,
    transaction_type: str,
    account_id: int,
    category_id: Optional[int] = None,
    description: Optional[str] = None,
    notes: Optional[str] = None,
    is_recurring: bool = False,
    tags: Optional[str] = None,
    source: str = "manual",
) -> Transaction:
    session = get_session()
    txn = Transaction(
        date=date_val,
        amount=abs(amount),
        transaction_type=transaction_type,
        account_id=account_id,
        category_id=category_id,
        description=description,
        notes=notes,
        is_recurring=is_recurring,
        tags=tags,
        source=source,
    )
    session.add(txn)

    # Update account balance
    account = session.query(Account).filter(Account.id == account_id).first()
    if account:
        if transaction_type in ("income", "payment"):
            account.balance += abs(amount)
        elif transaction_type in ("expense", "investment", "savings"):
            account.balance -= abs(amount)
        account.updated_at = datetime.utcnow()

    session.commit()
    txn_id = txn.id
    session.close()
    return get_transaction(txn_id)


def get_transaction(txn_id: int) -> Optional[Transaction]:
    session = get_session()
    txn = session.query(Transaction).filter(Transaction.id == txn_id).first()
    session.close()
    return txn


def get_transactions(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100,
    offset: int = 0,
) -> list:
    session = get_session()
    query = session.query(Transaction)

    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if transaction_type:
        query = query.filter(Transaction.transaction_type == transaction_type)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    transactions = query.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()
    session.close()
    return transactions


def delete_transaction(txn_id: int) -> bool:
    session = get_session()
    txn = session.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        session.close()
        return False

    account = session.query(Account).filter(Account.id == txn.account_id).first()
    if account:
        if txn.transaction_type in ("income", "payment"):
            account.balance -= txn.amount
        elif txn.transaction_type in ("expense", "investment", "savings"):
            account.balance += txn.amount
        account.updated_at = datetime.utcnow()

    session.delete(txn)
    session.commit()
    session.close()
    return True


def update_transaction(txn_id: int, **kwargs) -> Optional[Transaction]:
    session = get_session()
    txn = session.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        session.close()
        return None
    for key, value in kwargs.items():
        if hasattr(txn, key):
            setattr(txn, key, value)
    session.commit()
    session.close()
    return get_transaction(txn_id)


def get_monthly_summary(year: int, month: int) -> dict:
    session = get_session()
    results = {}
    for txn_type in ["income", "expense", "savings", "investment", "payment"]:
        total = (
            session.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                extract("year", Transaction.date) == year,
                extract("month", Transaction.date) == month,
                Transaction.transaction_type == txn_type,
            )
            .scalar()
        )
        results[txn_type] = float(total)

    results["net"] = results["income"] + results["payment"] - results["expense"] - results["savings"] - results["investment"]
    session.close()
    return results


def get_category_breakdown(year: int, month: int, transaction_type: str = "expense") -> list:
    session = get_session()
    results = (
        session.query(
            Category.name,
            Category.icon,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.transaction_type == transaction_type,
        )
        .group_by(Category.name, Category.icon)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    session.close()
    return [
        {"category": r.name, "icon": r.icon, "total": float(r.total), "count": r.count}
        for r in results
    ]


def get_daily_spending(year: int, month: int) -> list:
    session = get_session()
    results = (
        session.query(Transaction.date, func.sum(Transaction.amount).label("total"))
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.transaction_type == "expense",
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
        .all()
    )
    session.close()
    return [{"date": r.date, "total": float(r.total)} for r in results]


def get_spending_trend(months: int = 6) -> list:
    from dateutil.relativedelta import relativedelta

    session = get_session()
    today = date.today()
    trends = []

    for i in range(months - 1, -1, -1):
        target = today - relativedelta(months=i)
        y, m = target.year, target.month

        totals = {}
        for txn_type in ["income", "expense", "savings", "investment", "payment"]:
            total = (
                session.query(func.coalesce(func.sum(Transaction.amount), 0.0))
                .filter(
                    extract("year", Transaction.date) == y,
                    extract("month", Transaction.date) == m,
                    Transaction.transaction_type == txn_type,
                )
                .scalar()
            )
            totals[txn_type] = float(total)

        trends.append({"year": y, "month": m, **totals})

    session.close()
    return trends
