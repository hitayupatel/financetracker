"""Analytics page - Financial insights and charts."""

import streamlit as st
import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from datetime import date

from src.analytics import get_overview, get_top_expenses, get_income_sources
from src.transactions import get_category_breakdown, get_spending_trend, get_daily_spending


def render():
    st.title("📊 Analytics")

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
    selected_label = st.selectbox("📅 Month", month_labels, key="analytics_month")
    selected_date = months[month_labels.index(selected_label)]
    year, month = selected_date.year, selected_date.month

    overview = get_overview(year, month)
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Income", f"${overview['income']:,.0f}")
    c2.metric("Expenses", f"${overview['expense']:,.0f}")
    c3.metric("Payments", f"${overview['payment']:,.0f}")
    c4.metric("Savings Rate", f"{overview['savings_rate']:.0f}%")

    st.divider()

    # Category breakdown
    st.subheader("Expense by Category")
    categories = get_category_breakdown(year, month, "expense")
    if categories:
        df = pd.DataFrame(categories)
        fig = px.bar(df, y="category", x="total", orientation="h", text=df["total"].apply(lambda x: f"${x:,.0f}"), color_discrete_sequence=["#6366f1"])
        fig.update_layout(yaxis=dict(categoryorder="total ascending", title=""), xaxis=dict(visible=False), height=max(250, len(df)*35), showlegend=False, margin=dict(t=10, b=10))
        fig.update_traces(textposition="outside")
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Top expenses
    st.subheader("Top 10 Expenses")
    top = get_top_expenses(year, month)
    if top:
        rows = [{"Date": t.date.strftime("%b %d"), "Amount": f"${t.amount:,.2f}", "Description": t.description or "-"} for t in top]
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    st.divider()

    # 6-month trend
    st.subheader("6-Month Trend")
    trends = get_spending_trend(months=6)
    if any(t["income"] > 0 or t["expense"] > 0 for t in trends):
        df = pd.DataFrame(trends)
        df["month_label"] = df.apply(lambda r: f"{date(int(r['year']), int(r['month']), 1).strftime('%b %y')}", axis=1)
        fig = go.Figure()
        fig.add_trace(go.Bar(name="Income", x=df["month_label"], y=df["income"], marker_color="#10b981"))
        fig.add_trace(go.Bar(name="Expense", x=df["month_label"], y=df["expense"], marker_color="#ef4444"))
        fig.update_layout(barmode="group", xaxis_title="", yaxis_title="$", height=300)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("Not enough data for trends.")
