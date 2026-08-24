"""Import API endpoints for CSV and PDF."""

from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional

from src.csv_import import preview_csv, import_csv
from src.pdf_import import preview_pdf, import_pdf

router = APIRouter()


@router.post("/csv/preview")
async def csv_preview(file: UploadFile = File(...)):
    content = await file.read()
    return preview_csv(content)


@router.post("/csv")
async def csv_import(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    default_type: str = Form("expense"),
    amount_sign_rule: Optional[str] = Form(None),
):
    content = await file.read()
    return import_csv(
        file_content=content,
        account_id=account_id,
        default_type=default_type,
        amount_sign_rule=amount_sign_rule,
    )


@router.post("/pdf/preview")
async def pdf_preview(file: UploadFile = File(...)):
    content = await file.read()
    return preview_pdf(content)


@router.post("/pdf")
async def pdf_import(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    institution: Optional[str] = Form(None),
    default_type: str = Form("expense"),
):
    content = await file.read()
    return import_pdf(
        file_content=content,
        account_id=account_id,
        institution=institution,
        default_type=default_type,
    )
