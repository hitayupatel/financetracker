"""Analytics API endpoints."""

from fastapi import APIRouter
from datetime import date

from src.analytics import get_overview, get_top_expenses, get_income_sources
from src.transactions import (
    get_category_breakdown, get_daily_spending, get_spending_trend,
)

router = APIRouter()


@router.get("/overview")
def overview(year: int, month: int):
    return get_overview(year, month)


@router.get("/category-breakdown")
def category_breakdown(year: int, month: int, transaction_type: str = "expense"):
    return get_category_breakdown(year, month, transaction_type)


@router.get("/daily-spending")
def daily_spending(year: int, month: int):
    data = get_daily_spending(year, month)
    return [{"date": str(d["date"]), "total": d["total"]} for d in data]


@router.get("/trends")
def trends(months: int = 12):
    return get_spending_trend(months)


@router.get("/top-expenses")
def top_expenses(year: int, month: int, limit: int = 10):
    txns = get_top_expenses(year, month, limit)
    return [
        {"id": t.id, "date": str(t.date), "amount": t.amount, "description": t.description}
        for t in txns
    ]


@router.get("/available-months")
def available_months():
    """Return the list of months (YYYY-MM) that have transactions, newest first."""
    from src.database import get_session, Transaction
    from sqlalchemy import func

    session = get_session()
    earliest = session.query(func.min(Transaction.date)).scalar()
    latest = session.query(func.max(Transaction.date)).scalar()
    session.close()

    if not earliest or not latest:
        # No data — default to current month
        from datetime import date
        today = date.today()
        return [f"{today.year}-{today.month:02d}"]

    months = []
    y, m = latest.year, latest.month
    while (y > earliest.year) or (y == earliest.year and m >= earliest.month):
        months.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return months
