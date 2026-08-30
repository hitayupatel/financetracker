# Finance Minister

A local-first personal finance tracker. Import your bank and credit card statements, get spending automatically categorized (with help from a local LLM), track budgets, and ask an AI questions about your money. All data stays on your machine.

## What It Does

- **Multi-account tracking** — bank, credit card, wallet, and investment accounts with net worth calculation
- **Statement import** — CSV and PDF from Chase, Capital One, Discover, Marcus, Robinhood, Fidelity, Webull, and generic formats
- **Smart categorization** — bank-provided categories first, then keyword matching, then a local LLM for anything left over
- **Accurate cash flow** — distinguishes real spending from internal transfers (credit card payments, moving money to savings/investments) so you don't double-count
- **Budgets** — needs/wants/savings buckets with auto-suggestions based on your spending history, plus budget-vs-actual analysis and over-budget alerts
- **Analytics** — monthly overview, category breakdown, daily spending, 12-month trends, all with drill-down and search
- **AI chat** — ask questions about your finances, answered by a local LLM with your actual data as context

## Does It Have AI Capability?

Yes — and it is **100% local**. No financial data ever leaves your machine.

- **LLM runtime:** [Ollama](https://ollama.com) running on `localhost:11434`
- **Model:** `llama3.1` (8B) by default
- **Two AI features:**
  1. **Transaction categorization** — when keyword matching can't identify a merchant, the description is sent to the local LLM in batches to infer the category. Runs as a background job with live progress tracking and a run history log.
  2. **Finance chat** — a conversational assistant that receives your account balances, monthly summaries, and spending trends as context, then answers questions in natural language.

Categorization is layered for speed and privacy:
1. **Keyword matching** (instant, deterministic, no LLM) handles known merchants
2. **Local LLM fallback** only for descriptions keywords miss
3. **Manual override** — change any category directly from the UI

## Architecture

Single monorepo with two parts:

```
financetracker/
├── backend/              FastAPI + Python + SQLite
│   ├── main.py           app entry, router registration, CORS
│   ├── api/              REST + WebSocket endpoints
│   │   ├── accounts.py
│   │   ├── transactions.py
│   │   ├── import_routes.py
│   │   ├── analytics.py
│   │   ├── budget.py
│   │   ├── chat.py
│   │   └── jobs.py       background categorization + progress
│   ├── src/              business logic
│   │   ├── database.py   SQLAlchemy models (Account, Transaction, Category, Budget, JobRun)
│   │   ├── accounts.py
│   │   ├── transactions.py
│   │   ├── analytics.py
│   │   ├── categorizer.py  keyword + LLM categorization
│   │   ├── budget.py       buckets, auto-suggest, budget-vs-actual
│   │   ├── csv_import.py    CSV parsing + type detection
│   │   ├── pdf_import.py    per-bank PDF parsers
│   │   ├── llm.py          Ollama chat integration
│   │   └── job_tracker.py  shared background job state
│   └── data/finance.db     local SQLite database (gitignored)
└── frontend/             React + TypeScript + Vite + TailwindCSS + Recharts
    └── src/
        ├── App.tsx       routes
        ├── components/   Layout, TransactionList, CategorizationProgress
        └── pages/        Overview, Transactions, Accounts, Import, Analytics, Budget, Chat
```

## Backend Processing

**Framework:** FastAPI (Python), SQLAlchemy ORM, SQLite storage.

**Import pipeline:**
1. File uploaded → parsed (CSV via pandas, PDF via pdfplumber)
2. Per-bank format detection (columns, debit/credit vs single amount, statement institution)
3. Each row typed: `expense`, `income`, `refund`, `transfer`, `investment`, or `savings` based on column signs and description keywords
4. Duplicate detection (same date + amount + account) prevents re-import doubling
5. Categorization: CSV's own category → keyword match → local LLM fallback (background thread)
6. Account balance recalculated

**Transaction classification logic** avoids double-counting:
- Credit card purchases → `expense` on that card
- Paying the card bill from checking → `transfer` (excluded from spending)
- Moving money to Robinhood → `investment`; to Goldman/Marcus → `savings`
- Refunds reduce the category they belong to rather than inflating income

**Background jobs:** Categorization runs in a daemon thread with shared progress state, polled by the frontend and logged to a `JobRun` history table.

## API Reference

Base URL: `http://localhost:8000/api`

### Accounts (`/accounts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List accounts (`?active_only=true`) |
| GET | `/net-worth` | Net worth, assets, liabilities |
| POST | `/` | Create account |
| PUT | `/{account_id}` | Update account |
| DELETE | `/{account_id}` | Deactivate account |
| POST | `/{account_id}/recalculate` | Recompute balance from transactions |

### Transactions (`/transactions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List/filter (`account_id`, `category_id`, `transaction_type`, `start_date`, `end_date`, `search`, `limit`, `offset`) |
| POST | `/` | Create transaction |
| PUT | `/{txn_id}` | Update (supports clearing category to null) |
| DELETE | `/{txn_id}` | Delete |
| GET | `/categories` | List categories (`?category_type=`) |

### Import (`/import`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/csv/preview` | Detect columns/format before import |
| POST | `/csv` | Import CSV (`account_id`, `default_type`, `amount_sign_rule`) |
| POST | `/pdf/preview` | Detect institution + sample transactions |
| POST | `/pdf` | Import PDF (`account_id`, `institution`, `default_type`) |

### Analytics (`/analytics`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Monthly income/expense/refund/net/savings-rate (`year`, `month`) |
| GET | `/category-breakdown` | Spending per category (refunds netted out) |
| GET | `/daily-spending` | Daily expense totals |
| GET | `/trends` | Multi-month trend (`?months=12`) |
| GET | `/top-expenses` | Largest expenses (`?limit=10`) |

### Budget (`/budget`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/suggest` | Auto-suggest budget from history (`?months_back=3`) |
| GET | `/{year}/{month}` | Get saved budget |
| POST | `/` | Save budget allocations |
| GET | `/{year}/{month}/analysis` | Budget vs actual with bucket rollup + alerts |

### Chat (`/chat`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Ollama online + model availability |
| GET | `/insight` | Quick financial insight |
| POST | `/` | Send message (with financial context) |

### Jobs (`/jobs`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/recategorize` | Start background categorization (`?scope=uncategorized|all`) |
| GET | `/recategorize/status` | Current run progress |
| GET | `/categorization/status` | Shared progress (import or re-eval) |
| GET | `/history` | Past run history |
| WS | `/ws/progress` | WebSocket progress stream |

Interactive API docs available at `http://localhost:8000/docs` (FastAPI Swagger UI).

## How the Frontend Is Used

React SPA (Vite dev server on port 5173) that talks to the FastAPI backend. In development, Vite proxies `/api/*` to `localhost:8000`.

**Pages:**
- **Overview** — month selector, income/expense/refund/net metrics (clickable to drill into transactions), category pie chart with drill-down, daily spending chart
- **Transactions** — filterable/searchable table, inline category dropdown, inline edit/delete, background re-evaluate with progress + run history
- **Accounts** — net worth summary, add/edit accounts, recalculate balances
- **Import** — upload CSV/PDF with preview before committing
- **Analytics** — 12-month income vs expense chart with clickable bars that drill into monthly transactions
- **Budget** — set up budgets (auto-suggested), view budget-vs-actual by bucket and category
- **Ask AI** — chat interface backed by the local LLM

A floating, minimizable progress panel shows background categorization status on any page.

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

### Local AI (Ollama)
```bash
# install ollama, then:
ollama serve
ollama pull llama3.1
```

## Privacy

- Database is local SQLite (`backend/data/finance.db`, gitignored)
- LLM is local via Ollama — no cloud API calls with your financial data
- No external services receive transaction data

## Roadmap

- [ ] Investment tracking (holdings, gains/losses, dividends)
- [ ] Recurring transaction detection
- [ ] Budget rollover / spillover between buckets
- [ ] Export reports (PDF/CSV)
