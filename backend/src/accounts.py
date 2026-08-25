"""Account management for Finance Minister."""

from datetime import datetime
from typing import Optional

from sqlalchemy import func

from src.database import get_session, Account, Transaction


def create_account(
    name: str,
    account_type: str,
    institution: Optional[str] = None,
    balance: float = 0.0,
    currency: str = "USD",
    credit_limit: Optional[float] = None,
) -> Account:
    session = get_session()
    account = Account(
        name=name,
        account_type=account_type,
        institution=institution,
        balance=balance,
        currency=currency,
        credit_limit=credit_limit,
    )
    session.add(account)
    session.commit()
    account_id = account.id
    session.close()
    return get_account(account_id)


def get_account(account_id: int) -> Optional[Account]:
    session = get_session()
    account = session.query(Account).filter(Account.id == account_id).first()
    session.close()
    return account


def get_all_accounts(active_only: bool = True) -> list:
    session = get_session()
    query = session.query(Account)
    if active_only:
        query = query.filter(Account.is_active == True)
    accounts = query.order_by(Account.name).all()
    session.close()
    return accounts


def update_account(account_id: int, **kwargs) -> Optional[Account]:
    session = get_session()
    account = session.query(Account).filter(Account.id == account_id).first()
    if not account:
        session.close()
        return None
    for key, value in kwargs.items():
        if hasattr(account, key):
            setattr(account, key, value)
    account.updated_at = datetime.utcnow()
    session.commit()
    session.close()
    return get_account(account_id)


def deactivate_account(account_id: int) -> bool:
    session = get_session()
    account = session.query(Account).filter(Account.id == account_id).first()
    if not account:
        session.close()
        return False
    account.is_active = False
    account.updated_at = datetime.utcnow()
    session.commit()
    session.close()
    return True


def get_net_worth() -> dict:
    session = get_session()
    accounts = session.query(Account).filter(Account.is_active == True).all()

    assets = 0.0
    liabilities = 0.0
    breakdown = {"bank": 0.0, "wallet": 0.0, "investment": 0.0, "credit_card": 0.0}

    for acc in accounts:
        breakdown[acc.account_type] = breakdown.get(acc.account_type, 0.0) + acc.balance
        if acc.account_type == "credit_card":
            liabilities += abs(acc.balance)
        else:
            assets += acc.balance

    session.close()
    return {
        "net_worth": assets - liabilities,
        "total_assets": assets,
        "total_liabilities": liabilities,
        "breakdown": breakdown,
    }


def recalculate_balance(account_id: int) -> float:
    session = get_session()
    account = session.query(Account).filter(Account.id == account_id).first()
    if not account:
        session.close()
        return 0.0

    income = (
        session.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.account_id == account_id,
            Transaction.transaction_type.in_(["income", "payment", "refund"]),
        )
        .scalar()
    )

    expenses = (
        session.query(func.coalesce(func.sum(Transaction.amount), 0.0))
        .filter(
            Transaction.account_id == account_id,
            Transaction.transaction_type.in_(["expense", "investment", "savings"]),
        )
        .scalar()
    )

    new_balance = float(income) - float(expenses)
    account.balance = new_balance
    account.updated_at = datetime.utcnow()
    session.commit()
    session.close()
    return new_balance
