"""Import page - CSV and PDF import for bank/brokerage statements."""

import streamlit as st
import pandas as pd

from src.csv_import import preview_csv, import_csv
from src.pdf_import import preview_pdf, import_pdf
from src.accounts import get_all_accounts


def render():
    st.title("📥 Import Statements")
    st.caption("Import transactions from your bank or brokerage — CSV or PDF.")

    accounts = get_all_accounts()
    if not accounts:
        st.warning("Add an account first.")
        return

    account_options = {acc.name: acc.id for acc in accounts}
    selected_account = st.selectbox("Import to Account", list(account_options.keys()))

    tab_csv, tab_pdf = st.tabs(["📄 CSV Import", "📑 PDF Import"])

    with tab_csv:
        _csv_import(account_options, selected_account)
    with tab_pdf:
        _pdf_import(account_options, selected_account)


def _csv_import(account_options, selected_account):
    uploaded = st.file_uploader("Upload CSV", type=["csv"], key="csv_up")
    if uploaded:
        content = uploaded.read()
        preview = preview_csv(content)
        if "error" in preview:
            st.error(preview["error"])
            return

        detected = preview["detected_format"]
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Date", "✓" if detected["has_date"] else "✗")
        c2.metric("Description", "✓" if detected["has_description"] else "✗")
        c3.metric("Amount", "✓" if detected["has_amount"] else "✗")
        c4.metric("Debit/Credit", "✓" if detected["has_debit_credit"] else "✗")

        if preview["rows"]:
            st.dataframe(pd.DataFrame(preview["rows"]), use_container_width=True, hide_index=True)

        # If single amount column (no separate debit/credit), ask user how to interpret
        amount_sign_rule = None
        if detected["has_amount"] and not detected["has_debit_credit"]:
            amount_sign_rule = st.radio(
                "How should the Amount column be interpreted?",
                ["Negative = Expense, Positive = Income", "Positive = Expense, Negative = Income", "All values are Expenses", "All values are Income"],
                key="csv_sign_rule",
            )

        default_type = st.radio("Default type (for ambiguous rows)", ["expense", "income"], horizontal=True, key="csv_dt")

        if st.button("Import CSV", type="primary", use_container_width=True, key="csv_btn"):
            with st.spinner("Importing..."):
                result = import_csv(
                    file_content=content,
                    account_id=account_options[selected_account],
                    default_type=default_type,
                    amount_sign_rule=amount_sign_rule,
                )
            if result["success"]:
                st.success(f"Imported {result['imported']} transactions ({result['skipped']} skipped)")
            else:
                st.error(result.get("error", "Failed."))


def _pdf_import(account_options, selected_account):
    uploaded = st.file_uploader("Upload PDF Statement", type=["pdf"], key="pdf_up")
    if uploaded:
        content = uploaded.read()
        with st.spinner("Analyzing..."):
            preview = preview_pdf(content)

        if "error" in preview:
            st.error(preview["error"])
            return

        c1, c2, c3 = st.columns(3)
        c1.metric("Institution", preview["institution_display"])
        c2.metric("Year", str(preview["year"]))
        c3.metric("Transactions Found", str(preview["total_found"]))

        if preview["total_found"] == 0:
            st.warning("No transactions parsed. Try CSV instead.")
            return

        sample = []
        for txn in preview["sample_transactions"]:
            sample.append({"Date": str(txn["date"]), "Type": txn["type"].title(), "Amount": f"${txn['amount']:,.2f}", "Description": txn["description"][:60]})
        st.dataframe(pd.DataFrame(sample), use_container_width=True, hide_index=True)

        default_type = st.radio("Default type", ["expense", "income", "investment"], horizontal=True, key="pdf_dt")

        if st.button("Import PDF", type="primary", use_container_width=True, key="pdf_btn"):
            with st.spinner("Importing..."):
                result = import_pdf(file_content=content, account_id=account_options[selected_account], default_type=default_type)
            if result["success"]:
                st.success(f"Imported {result['imported']} from {result['institution']} ({result['skipped']} skipped)")
            else:
                st.error(result.get("error", "Failed."))
