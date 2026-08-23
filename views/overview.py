"""Overview page - Simple, clean financial dashboard."""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from datetime import date

from src.analytics import get_overview
from src.accounts import get_all_accounts, get_net_worth
from src.transactions import get_category_breakdown, get_daily_spending, get_spending_trend


def render():
    st.title("🏛️ Finance Minister")

    # Month picker - shows last 24 months
    today = date.today()
    months = []
    for i in range(24):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append(date(y, m, 1))

    month_labels = [d.strftime("%B %Y") for d in months]
    selected_label = st.selectbox("📅 Select Month", month_labels)
    selected_date = months[month_labels.index(selected_label)]
    year, month = selected_date.year, selected_date.month

    st.divider()

    # Net worth
    nw = get_net_worth()
    st.metric("💰 Net Worth", f"${nw['net_worth']:,.0f}")

    st.divider()

    # Monthly summary
    overview = get_overview(year, month)

    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("Income", f"${overview['income']:,.0f}")
    col2.metric("Expenses", f"${overview['expense']:,.0f}")
    col3.metric("Payments", f"${overview['payment']:,.0f}")
    col4.metric("Net", f"${overview['net']:,.0f}")
    col5.metric("Savings Rate", f"{overview['savings_rate']:.0f}%")

    st.divider()

    # Spending by category
    st.subheader("Where your money went")
    categories = get_category_breakdown(year, month, "expense")
    if categories:
        df = pd.DataFrame(categories)
        fig = px.bar(
            df, y="category", x="total", orientation="h",
            text=df["total"].apply(lambda x: f"${x:,.0f}"),
            color_discrete_sequence=["#6366f1"],
        )
        fig.update_layout(
            yaxis=dict(categoryorder="total ascending", title=""),
            xaxis=dict(title="", visible=False),
            margin=dict(t=10, b=10, l=10, r=10),
            height=max(250, len(df) * 35),
            showlegend=False,
        )
        fig.update_traces(textposition="outside")
        st.plotly_chart(fig, use_container_width=True)

        # Drill-down: select a category to see transactions
        cat_names = [c["category"] for c in categories]
        selected_cat = st.selectbox("🔍 View transactions for category", ["-- Select --"] + cat_names, key="cat_drill")
        if selected_cat != "-- Select --":
            from src.database import get_session, Category, Transaction
            session = get_session()
            cat = session.query(Category).filter(Category.name == selected_cat).first()
            if cat:
                from sqlalchemy import extract
                txns = (
                    session.query(Transaction)
                    .filter(
                        Transaction.category_id == cat.id,
                        extract("year", Transaction.date) == year,
                        extract("month", Transaction.date) == month,
                        Transaction.transaction_type == "expense",
                    )
                    .order_by(Transaction.date.desc())
                    .all()
                )
                if txns:
                    rows = [{"Date": t.date, "Amount": f"${t.amount:,.2f}", "Description": t.description or "-"} for t in txns]
                    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
                    st.caption(f"{len(txns)} transactions | Total: ${sum(t.amount for t in txns):,.2f}")
            session.close()
    else:
        st.info("No expenses this month.")

    st.divider()

    # Daily spending
    st.subheader("Daily spending")
    daily = get_daily_spending(year, month)
    if daily:
        df = pd.DataFrame(daily)
        df["date"] = pd.to_datetime(df["date"])
        fig = px.bar(df, x="date", y="total", color_discrete_sequence=["#ef4444"])
        fig.update_layout(
            xaxis=dict(title="", tickformat="%b %d"),
            yaxis=dict(title="$"),
            margin=dict(t=10, b=30, l=40, r=10),
            height=250, showlegend=False,
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No daily data.")

    st.divider()

    # Accounts
    st.subheader("Accounts")
    accounts = get_all_accounts()
    if accounts:
        for acc in accounts:
            col1, col2 = st.columns([3, 1])
            col1.write(f"**{acc.name}** ({acc.account_type.replace('_', ' ')})")
            col2.write(f"${acc.balance:,.0f}")
    else:
        st.info("No accounts yet. Go to Accounts to add one.")
