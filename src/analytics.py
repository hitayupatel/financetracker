"""Analytics and insights for Finance Minister."""

from datetime import date

from sqlalchemy import func, extract

from src.database import get_session, Transaction, Category, Account


def get_overview(year: int, month: int) -> dict:
    session = get_session()

    totals = {}
    for txn_type in ["income", "expense", "savings", "investment", "payment"]:
        total = (
            session.query(func.coalesce(func.sum(Transaction.amount), 0.0))
            .filter(
                extract("year", Transaction.date) == year,
                extract("month", Transaction.date) == month,
                Transaction.transaction_type == txn_type,
            )
            .scalar()
        )
        totals[txn_type] = float(total)

    txn_count = (
        session.query(func.count(Transaction.id))
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
        .scalar()
    )

    days_in_month = (date(year, month + 1, 1) - date(year, month, 1)).days if month < 12 else 31
    today = date.today()
    elapsed_days = today.day if (year == today.year and month == today.month) else days_in_month
    avg_daily_expense = totals["expense"] / max(elapsed_days, 1)

    savings_rate = 0.0
    if totals["income"] > 0:
        saved = totals["income"] - totals["expense"]
        savings_rate = (saved / totals["income"]) * 100

    session.close()
    return {
        "income": totals["income"],
        "expense": totals["expense"],
        "savings": totals["savings"],
        "investment": totals["investment"],
        "payment": totals["payment"],
        "net": totals["income"] + totals["payment"] - totals["expense"],
        "transaction_count": txn_count,
        "avg_daily_expense": avg_daily_expense,
        "savings_rate": savings_rate,
    }


def get_top_expenses(year: int, month: int, limit: int = 10) -> list:
    session = get_session()
    results = (
        session.query(Transaction)
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.transaction_type == "expense",
        )
        .order_by(Transaction.amount.desc())
        .limit(limit)
        .all()
    )
    session.close()
    return results


def get_income_sources(year: int, month: int) -> list:
    session = get_session()
    results = (
        session.query(
            Category.name,
            Category.icon,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.transaction_type == "income",
        )
        .group_by(Category.name, Category.icon)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    session.close()
    return [{"category": r.name, "icon": r.icon, "total": float(r.total)} for r in results]


def get_financial_summary_text(year: int, month: int) -> str:
    """Generate plain-text summary for LLM context."""
    overview = get_overview(year, month)
    from src.transactions import get_category_breakdown
    category_data = get_category_breakdown(year, month, "expense")

    lines = [
        f"Financial Summary for {year}-{month:02d}:",
        f"  Total Income: ${overview['income']:,.2f}",
        f"  Total Expenses: ${overview['expense']:,.2f}",
        f"  Payments: ${overview['payment']:,.2f}",
        f"  Investments: ${overview['investment']:,.2f}",
        f"  Net: ${overview['net']:,.2f}",
        f"  Savings Rate: {overview['savings_rate']:.1f}%",
        f"  Avg Daily Expense: ${overview['avg_daily_expense']:,.2f}",
        "",
        "Expense Breakdown by Category:",
    ]

    for cat in category_data:
        lines.append(f"  {cat['icon']} {cat['category']}: ${cat['total']:,.2f} ({cat['count']} txns)")

    return "\n".join(lines)
