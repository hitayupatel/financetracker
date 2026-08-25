"""Accounts API endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.accounts import (
    create_account, get_all_accounts, get_account, update_account,
    deactivate_account, get_net_worth, recalculate_balance,
)

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    account_type: str
    institution: Optional[str] = None
    balance: float = 0.0
    currency: str = "USD"
    credit_limit: Optional[float] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    institution: Optional[str] = None
    balance: Optional[float] = None
    currency: Optional[str] = None
    credit_limit: Optional[float] = None
    is_active: Optional[bool] = None


@router.get("/")
def list_accounts(active_only: bool = True):
    accounts = get_all_accounts(active_only=active_only)
    return [
        {
            "id": a.id, "name": a.name, "account_type": a.account_type,
            "institution": a.institution, "balance": a.balance,
            "currency": a.currency, "credit_limit": a.credit_limit,
            "is_active": a.is_active,
        }
        for a in accounts
    ]


@router.get("/net-worth")
def net_worth():
    return get_net_worth()


@router.post("/")
def create(data: AccountCreate):
    acc = create_account(
        name=data.name, account_type=data.account_type,
        institution=data.institution, balance=data.balance,
        currency=data.currency, credit_limit=data.credit_limit,
    )
    return {"id": acc.id, "name": acc.name}


@router.put("/{account_id}")
def update(account_id: int, data: AccountUpdate):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    acc = update_account(account_id, **updates)
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"id": acc.id, "name": acc.name}


@router.delete("/{account_id}")
def deactivate(account_id: int):
    if deactivate_account(account_id):
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Account not found")


@router.post("/{account_id}/recalculate")
def recalculate(account_id: int):
    balance = recalculate_balance(account_id)
    return {"balance": balance}
