"""Budget logic — needs/wants/savings buckets, auto-suggest, and budget vs actual analysis."""

from datetime import date
from typing import Optional

from sqlalchemy import func, extract
from dateutil.relativedelta import relativedelta

from src.database import get_session, Transaction, Category, Budget


# Map each category to a bucket: needs, wants, or savings
CATEGORY_BUCKET = {
    # Needs
    "Rent/Mortgage": "needs",
    "Utilities": "needs",
    "Groceries": "needs",
    "Transport": "needs",
    "Healthcare": "needs",
    "Insurance": "needs",
    "Education": "needs",
    # Wants
    "Dining": "wants",
    "Entertainment": "wants",
    "Shopping": "wants",
    "Subscriptions": "wants",
    "Personal Care": "wants",
    "Travel": "wants",
    "Gifts": "wants",
    "Other Expense": "wants",
    # Savings/Investments
    "Emergency Fund": "savings",
    "Goal Savings": "savings",
    "Other Savings": "savings",
    "Stocks": "savings",
    "Mutual Funds": "savings",
    "ETFs": "savings",
    "Crypto": "savings",
    "Real Estate": "savings",
    "401k/IRA": "savings",
    "Other Investment": "savings",
}


def get_bucket(category_name: str) -> str:
    """Return the bucket for a category name. Defaults to 'wants'."""
    return CATEGORY_BUCKET.get(category_name, "wants")


def get_monthly_spending_by_category(year: int, month: int) -> dict:
    """Get actual spending per category for a month (expense + investment + savings)."""
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
            Transaction.transaction_type.in_(["expense", "investment", "savings"]),
            # Exclude income-type categories that may be wrongly assigned to expenses
            Category.category_type != "income",
        )
        .group_by(Category.name, Category.icon)
        .all()
    )
    # Subtract refunds per category
    refunds = (
        session.query(Category.name, func.sum(Transaction.amount).label("total"))
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            Transaction.transaction_type == "refund",
        )
        .group_by(Category.name)
        .all()
    )
    refund_map = {r.name: float(r.total) for r in refunds}
    session.close()

    return {
        r.name: {
            "icon": r.icon,
            "spent": float(r.total) - refund_map.get(r.name, 0),
            "bucket": get_bucket(r.name),
        }
        for r in results
    }


def suggest_budget(months_back: int = 3) -> dict:
    """Auto-suggest a budget based on average spending over the last N months."""
    today = date.today()
    session = get_session()

    # Get all expense-side categories
    all_cats = session.query(Category).filter(
        Category.category_type.in_(["expense", "investment", "savings"])
    ).all()

    category_totals = {}  # name -> list of monthly totals
    for c in all_cats:
        category_totals[c.name] = {"icon": c.icon, "bucket": get_bucket(c.name), "monthly": []}

    for i in range(months_back):
        target = today - relativedelta(months=i + 1)  # skip current partial month
        y, m = target.year, target.month
        rows = (
            session.query(Category.name, func.sum(Transaction.amount).label("total"))
            .join(Category, Transaction.category_id == Category.id)
            .filter(
                extract("year", Transaction.date) == y,
                extract("month", Transaction.date) == m,
                Transaction.transaction_type.in_(["expense", "investment", "savings"]),
            )
            .group_by(Category.name)
            .all()
        )
        month_map = {r.name: float(r.total) for r in rows}
        for name in category_totals:
            category_totals[name]["monthly"].append(month_map.get(name, 0))

    session.close()

    # Average and round to nearest $10
    categories = []
    bucket_totals = {"needs": 0, "wants": 0, "savings": 0}
    for name, data in category_totals.items():
        avg = sum(data["monthly"]) / max(len(data["monthly"]), 1)
        if avg < 1:
            continue  # skip categories with no spend
        suggested = round(avg / 10) * 10
        categories.append({
            "category": name,
            "icon": data["icon"],
            "bucket": data["bucket"],
            "suggested": suggested,
            "avg": round(avg, 2),
        })
        bucket_totals[data["bucket"]] += suggested

    categories.sort(key=lambda x: x["suggested"], reverse=True)
    overall = sum(bucket_totals.values())

    return {
        "overall": overall,
        "buckets": bucket_totals,
        "categories": categories,
        "months_analyzed": months_back,
    }


def get_budget(year: int, month: int) -> dict:
    """Get saved budget for a month, or empty if none set."""
    session = get_session()
    budgets = (
        session.query(Budget, Category)
        .join(Category, Budget.category_id == Category.id)
        .filter(Budget.year == year, Budget.month == month)
        .all()
    )
    session.close()

    if not budgets:
        return {"exists": False, "categories": []}

    return {
        "exists": True,
        "categories": [
            {
                "category_id": b.Budget.category_id,
                "category": b.Category.name,
                "icon": b.Category.icon,
                "bucket": get_bucket(b.Category.name),
                "amount": b.Budget.amount,
            }
            for b in budgets
        ],
    }


def save_budget(year: int, month: int, allocations: list) -> dict:
    """Save budget allocations. allocations = [{category_id, amount}]."""
    session = get_session()

    # Clear existing budget for this month
    session.query(Budget).filter(Budget.year == year, Budget.month == month).delete()

    for alloc in allocations:
        if alloc.get("amount", 0) > 0:
            session.add(Budget(
                category_id=alloc["category_id"],
                year=year,
                month=month,
                amount=alloc["amount"],
            ))

    session.commit()
    session.close()
    return {"saved": True}


def budget_vs_actual(year: int, month: int) -> dict:
    """Compare budget to actual spending, with bucket rollup and spillover."""
    budget = get_budget(year, month)
    actual = get_monthly_spending_by_category(year, month)

    # Build per-category comparison
    budget_map = {b["category"]: b for b in budget["categories"]}
    all_categories = set(budget_map.keys()) | set(actual.keys())

    categories = []
    bucket_data = {
        "needs": {"budget": 0, "spent": 0},
        "wants": {"budget": 0, "spent": 0},
        "savings": {"budget": 0, "spent": 0},
    }

    for cat in all_categories:
        b = budget_map.get(cat)
        a = actual.get(cat)
        budgeted = b["amount"] if b else 0
        spent = a["spent"] if a else 0
        bucket = get_bucket(cat)
        icon = (b["icon"] if b else (a["icon"] if a else ""))

        categories.append({
            "category": cat,
            "icon": icon,
            "bucket": bucket,
            "budget": budgeted,
            "spent": spent,
            "remaining": budgeted - spent,
            "pct": (spent / budgeted * 100) if budgeted > 0 else (100 if spent > 0 else 0),
            "over": spent > budgeted and budgeted > 0,
        })

        bucket_data[bucket]["budget"] += budgeted
        bucket_data[bucket]["spent"] += spent

    categories.sort(key=lambda x: x["spent"], reverse=True)

    # Bucket rollup with spillover indicator
    buckets = []
    for name, d in bucket_data.items():
        buckets.append({
            "bucket": name,
            "budget": d["budget"],
            "spent": d["spent"],
            "remaining": d["budget"] - d["spent"],
            "pct": (d["spent"] / d["budget"] * 100) if d["budget"] > 0 else (100 if d["spent"] > 0 else 0),
            "over": d["spent"] > d["budget"] and d["budget"] > 0,
        })

    total_budget = sum(d["budget"] for d in bucket_data.values())
    total_spent = sum(d["spent"] for d in bucket_data.values())

    # Alerts: categories or buckets at/over 100%
    alerts = []
    for c in categories:
        if c["over"]:
            alerts.append(f"{c['icon']} {c['category']} is over budget (${c['spent']:.0f} / ${c['budget']:.0f})")
    for b in buckets:
        if b["over"]:
            alerts.append(f"{b['bucket'].title()} bucket is over budget (${b['spent']:.0f} / ${b['budget']:.0f})")

    return {
        "has_budget": budget["exists"],
        "overall": {
            "budget": total_budget,
            "spent": total_spent,
            "remaining": total_budget - total_spent,
            "pct": (total_spent / total_budget * 100) if total_budget > 0 else 0,
        },
        "buckets": buckets,
        "categories": categories,
        "alerts": alerts,
    }
