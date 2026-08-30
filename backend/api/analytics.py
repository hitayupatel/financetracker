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
def available_months(future: int = 0):
    """Return months (YYYY-MM) newest first.

    Range: from the latest of (current month, most-recent transaction) plus
    `future` upcoming months, back through the earliest transaction month.
    Set future>0 for forward-looking pickers like budgets.
    """
    from src.database import get_session, Transaction
    from sqlalchemy import func
    from datetime import date

    session = get_session()
    earliest = session.query(func.min(Transaction.date)).scalar()
    latest = session.query(func.max(Transaction.date)).scalar()
    session.close()

    today = date.today()

    # Start (oldest) = earliest transaction month, or current month if no data
    if earliest:
        start_y, start_m = earliest.year, earliest.month
    else:
        start_y, start_m = today.year, today.month

    # End (newest) = max(current month, latest transaction month) + future months
    end_y, end_m = today.year, today.month
    if latest and (latest.year > end_y or (latest.year == end_y and latest.month > end_m)):
        end_y, end_m = latest.year, latest.month
    # Add future months
    end_m += future
    while end_m > 12:
        end_m -= 12
        end_y += 1

    months = []
    y, m = end_y, end_m
    while (y > start_y) or (y == start_y and m >= start_m):
        months.append(f"{y}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return months
