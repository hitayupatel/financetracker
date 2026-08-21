"""Transactions page - View, add, edit, and manage transactions."""

import streamlit as st
import pandas as pd
from datetime import date

from src.transactions import add_transaction, get_transactions, delete_transaction, update_transaction, get_category_breakdown
from src.accounts import get_all_accounts
from src.categorizer import get_all_categories, categorize_transaction, get_category_suggestions
from src.database import get_session, Category


def render():
    st.title("📋 Transactions")
    tab_add, tab_list = st.tabs(["Add Transaction", "View Transactions"])
    with tab_add:
        _render_add_form()
    with tab_list:
        _render_transaction_list()


def _render_add_form():
    accounts = get_all_accounts()
    if not accounts:
        st.warning("No accounts found. Add one in Accounts page first.")
        return

    categories = get_all_categories()

    with st.form("add_transaction", clear_on_submit=True):
        col1, col2 = st.columns(2)
        with col1:
            txn_date = st.date_input("Date", value=date.today())
            amount = st.number_input("Amount ($)", min_value=0.01, step=10.0, format="%.2f")
            txn_type = st.selectbox("Type", ["expense", "income", "payment", "investment", "savings"], format_func=str.title)
        with col2:
            account_options = {acc.name: acc.id for acc in accounts}
            selected_account = st.selectbox("Account", list(account_options.keys()))
            type_categories = [c for c in categories if c.category_type == txn_type] if txn_type not in ("payment",) else categories
            cat_options = {"-- Auto-detect --": None}
            cat_options.update({f"{c.icon} {c.name}": c.id for c in type_categories})
            selected_cat = st.selectbox("Category", list(cat_options.keys()))
            description = st.text_input("Description")

        notes = st.text_area("Notes (optional)", height=68)

        submitted = st.form_submit_button("Add Transaction", type="primary", use_container_width=True)
        if submitted:
            category_id = cat_options[selected_cat]
            if category_id is None and description:
                category_id = categorize_transaction(description)
            add_transaction(
                date_val=txn_date, amount=amount, transaction_type=txn_type,
                account_id=account_options[selected_account],
                category_id=category_id, description=description or None, notes=notes or None,
            )
            st.success(f"Added {txn_type} of ${amount:,.2f}")


def _render_transaction_list():
    accounts = get_all_accounts()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        filter_type = st.selectbox("Type", ["All", "expense", "income", "payment", "investment", "savings"], format_func=str.title, key="ft")
    with col2:
        acc_opts = {"All Accounts": None}
        acc_opts.update({a.name: a.id for a in accounts})
        filter_acc = st.selectbox("Account", list(acc_opts.keys()), key="fa")
    with col3:
        start = st.date_input("From", value=date.today().replace(day=1), key="fs")
    with col4:
        end = st.date_input("To", value=date.today(), key="fe")

    transactions = get_transactions(
        account_id=acc_opts[filter_acc],
        transaction_type=filter_type if filter_type != "All" else None,
        start_date=start, end_date=end, limit=200,
    )

    if not transactions:
        st.info("No transactions found.")
        return

    session = get_session()
    rows = []
    for txn in transactions:
        cat_name = ""
        if txn.category_id:
            cat = session.query(Category).filter(Category.id == txn.category_id).first()
            cat_name = f"{cat.icon} {cat.name}" if cat else ""
        acc = next((a for a in accounts if a.id == txn.account_id), None)
        rows.append({
            "ID": txn.id, "Date": txn.date, "Type": txn.transaction_type.title(),
            "Amount": f"${txn.amount:,.2f}", "Category": cat_name,
            "Description": txn.description or "-",
            "Source": (txn.source or "manual").replace("_", " ").title(),
            "Account": acc.name if acc else "?",
        })
    session.close()

    df = pd.DataFrame(rows)
    total = sum(t.amount for t in transactions)
    st.caption(f"Showing {len(transactions)} transactions | Total: ${total:,.2f}")
    st.dataframe(df.drop(columns=["ID"]), use_container_width=True, hide_index=True)

    # Edit
    with st.expander("Edit a transaction"):
        txn_ids = [r["ID"] for r in rows]
        txn_id_to_edit = st.selectbox(
            "Select transaction",
            txn_ids,
            format_func=lambda x: f"#{x} - {next((r['Description'] for r in rows if r['ID'] == x), '')} ({next((r['Amount'] for r in rows if r['ID'] == x), '')})",
            key="edit_sel",
        )
        current_txn = next((t for t in transactions if t.id == txn_id_to_edit), None)
        if current_txn:
            col1, col2 = st.columns(2)
            with col1:
                new_date = st.date_input("Date", value=current_txn.date, key="ed")
                new_amount = st.number_input("Amount ($)", value=current_txn.amount, min_value=0.01, step=1.0, key="ea")
                types = ["expense", "income", "payment", "investment", "savings"]
                new_type = st.selectbox("Type", types, index=types.index(current_txn.transaction_type) if current_txn.transaction_type in types else 0, key="et")
            with col2:
                new_desc = st.text_input("Description", value=current_txn.description or "", key="edesc")
                all_cats = get_all_categories()
                cat_options = {"-- None --": None}
                cat_options.update({f"{c.icon} {c.name}": c.id for c in all_cats})
                current_key = "-- None --"
                for k, v in cat_options.items():
                    if v == current_txn.category_id:
                        current_key = k
                        break
                new_cat = st.selectbox("Category", list(cat_options.keys()), index=list(cat_options.keys()).index(current_key), key="ecat")
                new_notes = st.text_input("Notes", value=current_txn.notes or "", key="en")

            if st.button("Save Changes", type="primary", key="save_edit"):
                update_transaction(txn_id_to_edit, date=new_date, amount=new_amount, transaction_type=new_type, description=new_desc or None, category_id=cat_options[new_cat], notes=new_notes or None)
                st.success(f"Updated #{txn_id_to_edit}")
                st.rerun()

    # Delete
    with st.expander("Delete a transaction"):
        txn_id_del = st.selectbox("Select transaction to delete", [r["ID"] for r in rows], format_func=lambda x: f"#{x} - {next((r['Description'] for r in rows if r['ID'] == x), '')}", key="del_sel")
        if st.button("Delete", type="secondary", key="del_btn"):
            if delete_transaction(txn_id_del):
                st.success(f"Deleted #{txn_id_del}")
                st.rerun()
