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
