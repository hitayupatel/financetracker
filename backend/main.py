"""Finance Minister - FastAPI Backend."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database import setup_database
from api.accounts import router as accounts_router
from api.transactions import router as transactions_router
from api.import_routes import router as import_router
from api.analytics import router as analytics_router
from api.chat import router as chat_router
from api.jobs import router as jobs_router
from api.budget import router as budget_router

setup_database()

app = FastAPI(title="Finance Minister", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts_router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(transactions_router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(import_router, prefix="/api/import", tags=["Import"])
app.include_router(analytics_router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(budget_router, prefix="/api/budget", tags=["Budget"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
