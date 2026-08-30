"""Budget API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from src.budget import suggest_budget, get_budget, save_budget, budget_vs_actual

router = APIRouter()


class Allocation(BaseModel):
    category_id: int
    amount: float


class BudgetSave(BaseModel):
    year: int
    month: int
    allocations: list[Allocation]


@router.get("/months-with-budget")
def months_with_budget():
    """Return list of 'YYYY-MM' strings that have a budget configured."""
    from src.database import get_session, Budget
    session = get_session()
    rows = session.query(Budget.year, Budget.month).distinct().all()
    session.close()
    return [f"{y}-{m:02d}" for (y, m) in rows]


@router.get("/suggest")
def suggest(months_back: int = 3):
    return suggest_budget(months_back)


@router.get("/{year}/{month}")
def get(year: int, month: int):
    return get_budget(year, month)


@router.post("/")
def save(data: BudgetSave):
    allocations = [{"category_id": a.category_id, "amount": a.amount} for a in data.allocations]
    return save_budget(data.year, data.month, allocations)


@router.get("/{year}/{month}/analysis")
def analysis(year: int, month: int):
    return budget_vs_actual(year, month)
