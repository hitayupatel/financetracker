"""Accounts page - Manage accounts."""

import streamlit as st
from src.accounts import create_account, get_all_accounts, deactivate_account, get_net_worth, recalculate_balance


def render():
    st.title("🏦 Accounts")
    tab_view, tab_add = st.tabs(["My Accounts", "Add Account"])
    with tab_view:
        _render_view()
    with tab_add:
        _render_add()


def _render_view():
    nw = get_net_worth()
    col1, col2, col3 = st.columns(3)
    col1.metric("Net Worth", f"${nw['net_worth']:,.2f}")
    col2.metric("Total Assets", f"${nw['total_assets']:,.2f}")
    col3.metric("Total Liabilities", f"${nw['total_liabilities']:,.2f}")

    st.divider()
    accounts = get_all_accounts(active_only=False)
    if not accounts:
        st.info("No accounts yet. Add one!")
        return

    for acc in accounts:
        col1, col2, col3 = st.columns([3, 2, 1])
        status = "🟢" if acc.is_active else "🔴"
        col1.write(f"{status} **{acc.name}** — {acc.institution or acc.account_type.replace('_', ' ').title()}")
        col2.write(f"${acc.balance:,.2f}")
        if acc.is_active:
            if col3.button("🗑️", key=f"deact_{acc.id}"):
                deactivate_account(acc.id)
                st.rerun()

    st.divider()
    if st.button("🔄 Recalculate All Balances"):
        for acc in accounts:
            recalculate_balance(acc.id)
        st.success("Done!")
        st.rerun()


def _render_add():
    with st.form("add_account", clear_on_submit=True):
        name = st.text_input("Account Name", placeholder="e.g., Chase Sapphire")
        account_type = st.selectbox("Type", ["bank", "credit_card", "wallet", "investment"], format_func=lambda x: x.replace("_", " ").title())
        institution = st.text_input("Institution", placeholder="e.g., Chase, Capital One")
        balance = st.number_input("Opening Balance ($)", value=0.0, step=100.0)
        credit_limit = None
        if account_type == "credit_card":
            credit_limit = st.number_input("Credit Limit ($)", value=0.0, step=1000.0)

        if st.form_submit_button("Add Account", type="primary", use_container_width=True):
            if not name:
                st.error("Name required.")
            else:
                create_account(name=name, account_type=account_type, institution=institution or None, balance=balance, credit_limit=credit_limit if credit_limit else None)
                st.success(f"Added '{name}'!")
                st.rerun()
