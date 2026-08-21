"""Seed DEMO data for Finance Minister. All data tagged source='demo'."""

import sys
from pathlib import Path
from datetime import date, timedelta
import random

sys.path.insert(0, str(Path(__file__).parent))

from src.database import setup_database, get_session, Category
from src.accounts import create_account
from src.transactions import add_transaction


def seed():
    setup_database()
    session = get_session()
    from src.database import Transaction
    if session.query(Transaction).count() > 0:
        print("DB already has data. Skipping.")
        session.close()
        return
    session.close()

    print("Creating demo accounts...")
    chase = create_account("Chase Checking", "bank", "Chase", balance=0.0)
    discover = create_account("Discover It", "credit_card", "Discover", balance=0.0, credit_limit=10000.0)
    marcus = create_account("Marcus Savings", "bank", "Goldman Sachs", balance=0.0)
    capital_one = create_account("Capital One Venture", "credit_card", "Capital One", balance=0.0, credit_limit=15000.0)
    robinhood = create_account("Robinhood", "investment", "Robinhood", balance=0.0)

    session = get_session()
    categories = {c.name: c.id for c in session.query(Category).all()}
    session.close()

    today = date.today()

    for months_ago in range(3):
        m = today.month - months_ago
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        base = date(y, m, 1)

        add_transaction(date_val=base, amount=6500.0, transaction_type="income", account_id=chase.id, category_id=categories.get("Salary"), description="Direct Deposit - Acme Corp", source="demo")

    recurring = [
        ("Rent/Mortgage", "Apartment rent", 1800, chase.id),
        ("Utilities", "Comcast internet", 79, chase.id),
        ("Subscriptions", "Netflix", 15.49, discover.id),
        ("Insurance", "GEICO auto", 120, chase.id),
    ]
    for months_ago in range(3):
        m = today.month - months_ago
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        base = date(y, m, 1)
        for cat, desc, amt, acc_id in recurring:
            add_transaction(date_val=base + timedelta(days=random.randint(1, 5)), amount=float(amt), transaction_type="expense", account_id=acc_id, category_id=categories.get(cat), description=desc, source="demo")

    templates = [
        ("Groceries", ["King Soopers", "Costco", "Trader Joe's"], (30, 150), discover.id),
        ("Dining", ["Chipotle", "Starbucks", "DoorDash"], (8, 60), discover.id),
        ("Transport", ["Shell gas", "Uber ride"], (10, 55), chase.id),
        ("Shopping", ["Amazon", "Target"], (15, 120), capital_one.id),
    ]
    for months_ago in range(3):
        m = today.month - months_ago
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        base = date(y, m, 1)
        for cat, descs, (lo, hi), acc_id in templates:
            for _ in range(random.randint(3, 7)):
                add_transaction(date_val=base + timedelta(days=random.randint(0, 27)), amount=round(random.uniform(lo, hi), 2), transaction_type="expense", account_id=acc_id, category_id=categories.get(cat), description=random.choice(descs), source="demo")

    for months_ago in range(3):
        m = today.month - months_ago
        y = today.year
        if m <= 0:
            m += 12
            y -= 1
        base = date(y, m, 1)
        add_transaction(date_val=base + timedelta(days=5), amount=500.0, transaction_type="investment", account_id=robinhood.id, category_id=categories.get("ETFs"), description="Buy VOO", source="demo")
        add_transaction(date_val=base + timedelta(days=2), amount=1000.0, transaction_type="savings", account_id=marcus.id, category_id=categories.get("Emergency Fund"), description="Monthly savings", source="demo")

    print("Done! Demo data loaded.")


def clear_demo_data():
    from src.database import get_session, Transaction, Account
    session = get_session()
    count = session.query(Transaction).filter(Transaction.source == "demo").count()
    if count == 0:
        print("No demo data.")
        session.close()
        return
    session.query(Transaction).filter(Transaction.source == "demo").delete()
    session.commit()
    accounts = session.query(Account).all()
    for acc in accounts:
        if session.query(Transaction).filter(Transaction.account_id == acc.id).count() == 0:
            session.delete(acc)
    session.commit()
    session.close()
    print(f"Cleared {count} demo transactions.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()
    if args.clear:
        clear_demo_data()
    else:
        seed()
