# Finance Minister

Local personal finance tracker with FastAPI backend and React frontend.

## Architecture

```
backend/       FastAPI + Python (API, database, LLM, import logic)
frontend/      React + TypeScript + TailwindCSS + Recharts
```

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### LLM (optional, for AI chat + categorization)
```bash
ollama serve
ollama pull llama3.1
```

## Features

- Multi-account tracking (bank, credit card, wallet, investment)
- CSV/PDF import (Chase, Capital One, Discover, Marcus, Robinhood, Fidelity, Webull)
- Smart categorization (bank categories → LLM fallback)
- Background re-categorization with WebSocket progress
- Analytics with interactive charts
- AI chat powered by local LLM
- Duplicate detection on import
- Transaction editing
- All data stays local (SQLite + Ollama)

## API Endpoints

- `GET /api/health` — health check
- `GET /api/accounts` — list accounts
- `POST /api/accounts` — create account
- `GET /api/transactions` — list transactions
- `POST /api/import/csv` — import CSV
- `POST /api/import/pdf` — import PDF
- `GET /api/analytics/overview` — monthly overview
- `POST /api/chat` — send message to AI
- `POST /api/jobs/recategorize` — start background re-categorization
- `WS /api/jobs/ws/progress` — WebSocket for job progress
