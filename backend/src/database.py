"""Database models and session management for Finance Minister."""

from datetime import datetime, date

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from src.config import get_db_path

Base = declarative_base()


class Account(Base):
    """Bank accounts, credit cards, wallets, investment accounts."""

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    account_type = Column(String(50), nullable=False)  # bank, credit_card, wallet, investment
    institution = Column(String(100), nullable=True)
    balance = Column(Float, default=0.0)
    currency = Column(String(10), default="USD")
    credit_limit = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class Category(Base):
    """Transaction categories."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    category_type = Column(String(50), nullable=False)  # income, expense, investment, savings
    icon = Column(String(10), nullable=True)
    is_default = Column(Boolean, default=True)

    transactions = relationship("Transaction", back_populates="category")


class Transaction(Base):
    """Individual financial transactions."""

    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String(20), nullable=False)  # income, expense, payment, investment, savings
    description = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_recurring = Column(Boolean, default=False)
    source = Column(String(20), default="manual")  # manual, csv_import, pdf_import, demo
    tags = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")


class Budget(Base):
    """Monthly budgets per category."""

    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("Category")


class JobRun(Base):
    """History of categorization / re-evaluation runs."""

    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(20), nullable=False)  # import, reevaluate
    scope = Column(String(30), nullable=True)  # uncategorized, all
    total = Column(Integer, default=0)
    updated = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    model = Column(String(50), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


# Database session management

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        db_path = get_db_path()
        _engine = create_engine(f"sqlite:///{db_path}", echo=False)
    return _engine


def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        engine = get_engine()
        _SessionLocal = sessionmaker(bind=engine)
    return _SessionLocal()


from contextlib import contextmanager

@contextmanager
def managed_session():
    """Context manager for safe session handling. Use: with managed_session() as session:"""
    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def is_duplicate_transaction(session, account_id: int, txn_date, amount: float, description: str) -> bool:
    """Check if a transaction with same date and amount already exists on this account."""
    query = session.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.date == txn_date,
        Transaction.amount == amount,
    )
    # If description provided, check for exact match OR existing entry with no description
    if description:
        from sqlalchemy import or_
        query = query.filter(
            or_(Transaction.description == description, Transaction.description == None)
        )
    return query.first() is not None


def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)


def seed_categories():
    """Seed default categories from config."""
    from src.config import get_categories

    session = get_session()
    existing = session.query(Category).count()
    if existing > 0:
        session.close()
        return

    categories = get_categories()
    icons = {
        "Salary": "💰", "Freelance": "💻", "Interest": "🏦", "Dividends": "📈",
        "Refunds": "↩️", "Other Income": "💵",
        "Groceries": "🛒", "Dining": "🍽️", "Transport": "🚗", "Utilities": "💡",
        "Rent/Mortgage": "🏠", "Healthcare": "🏥", "Entertainment": "🎬",
        "Shopping": "🛍️", "Subscriptions": "📱", "Education": "📚",
        "Travel": "✈️", "Insurance": "🛡️", "Personal Care": "💇",
        "Gifts": "🎁", "Other Expense": "📋",
        "Stocks": "📊", "Mutual Funds": "📉", "ETFs": "📈",
        "Crypto": "🪙", "Real Estate": "🏘️", "401k/IRA": "🏦",
        "Other Investment": "💹",
        "Emergency Fund": "🆘", "Goal Savings": "🎯", "Other Savings": "🐖",
    }

    for cat_type, cat_names in categories.items():
        for name in cat_names:
            category = Category(
                name=name,
                category_type=cat_type,
                icon=icons.get(name, "📌"),
                is_default=True,
            )
            session.add(category)

    session.commit()
    session.close()


def setup_database():
    """Full database setup: create tables and seed data."""
    init_db()
    seed_categories()
