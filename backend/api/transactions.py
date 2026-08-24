"""Transactions API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date

from src.transactions import (
    add_transaction, get_transactions, get_transaction,
    update_transaction, delete_transaction,
)
from src.categorizer import get_all_categories

router = APIRouter()


class TransactionCreate(BaseModel):
    date: date
    amount: float
    transaction_type: str
    account_id: int
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    is_recurring: bool = False
    source: str = "manual"


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = None
    transaction_type: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_transactions(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 200,
    offset: int = 0,
):
    txns = get_transactions(
        account_id=account_id, category_id=category_id,
        transaction_type=transaction_type,
        start_date=start_date, end_date=end_date,
        limit=limit, offset=offset,
    )
    return [
        {
            "id": t.id, "date": str(t.date), "amount": t.amount,
            "transaction_type": t.transaction_type,
            "description": t.description, "notes": t.notes,
            "account_id": t.account_id, "category_id": t.category_id,
            "source": t.source, "is_recurring": t.is_recurring,
        }
        for t in txns
    ]


@router.post("/")
def create(data: TransactionCreate):
    txn = add_transaction(
        date_val=data.date, amount=data.amount,
        transaction_type=data.transaction_type,
        account_id=data.account_id, category_id=data.category_id,
        description=data.description, notes=data.notes,
        is_recurring=data.is_recurring, source=data.source,
    )
    return {"id": txn.id}


@router.put("/{txn_id}")
def update(txn_id: int, data: TransactionUpdate):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    txn = update_transaction(txn_id, **updates)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"id": txn.id}


@router.delete("/{txn_id}")
def delete(txn_id: int):
    if delete_transaction(txn_id):
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Transaction not found")


@router.get("/categories")
def categories(category_type: Optional[str] = None):
    cats = get_all_categories(category_type)
    return [{"id": c.id, "name": c.name, "icon": c.icon, "category_type": c.category_type} for c in cats]
