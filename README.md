# Finance Minister

A local personal finance tracker that categorizes spending, tracks accounts, and uses a local LLM for financial insights.

## Features

- **Multi-account tracking** — bank, credit card, wallet, investment accounts
- **CSV import** — supports Chase, Capital One, Discover, and generic formats
- **PDF import** — parses statements from Chase, Discover, Capital One, Marcus, Robinhood, Fidelity, Webull
- **Smart categorization** — uses bank's own categories first, then local LLM (Ollama) for the rest
- **Duplicate detection** — re-importing the same statement won't create duplicates
- **Transaction editing** — edit/delete any transaction, re-evaluate categories via LLM
- **Analytics** — category breakdown, daily spending, monthly trends
- **AI chat** — ask questions about your finances using a local LLM
- **100% local** — all data stays on your machine, no cloud APIs

## Tech Stack

- **Backend**: Python, SQLAlchemy, SQLite
- **Frontend**: Streamlit (migrating to FastAPI + React)
- **LLM**: Ollama (llama3.1)
- **Charts**: Plotly

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Install and start Ollama
brew install ollama
ollama serve
ollama pull llama3.1

# Run the app
streamlit run app.py
```

Open http://localhost:8501

## Usage

1. **Add accounts** — Go to Accounts > Add Account (Chase Checking, Capital One credit card, etc.)
2. **Import statements** — Go to Import > upload CSV or PDF from your bank
3. **View overview** — Select a month to see spending breakdown, daily chart, category drill-down
4. **Ask AI** — Chat with your local LLM about your finances
5. **Re-evaluate categories** — Transactions > Re-evaluate categories to re-run LLM categorization

## Supported CSV Formats

- **Capital One** — Transaction Date, Debit, Credit, Category columns
- **Chase** — Posting Date, Description, Amount, Type columns (handles trailing commas)
- **Generic** — any CSV with date + amount or debit/credit columns

## Data

- Database: `data/finance.db` (SQLite, gitignored)
- All transactions tagged with source: `manual`, `csv_import`, `pdf_import`, `demo`

## Roadmap

- [ ] Migrate to FastAPI + React for better UI (background jobs, real-time progress, SPA navigation)
- [ ] Plaid integration for live bank connections
- [ ] Budget tracking and alerts
- [ ] Recurring transaction detection
