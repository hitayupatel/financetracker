"""Accounts page - Manage accounts."""

import streamlit as st
from src.accounts import create_account, get_all_accounts, update_account, deactivate_account, get_net_worth, recalculate_balance


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
        col1, col2, col3, col4 = st.columns([3, 2, 1, 1])
        status = "🟢" if acc.is_active else "🔴"
        col1.write(f"{status} **{acc.name}** — {acc.institution or acc.account_type.replace('_', ' ').title()}")
        col2.write(f"${acc.balance:,.2f}")
        if col3.button("✏️", key=f"edit_{acc.id}"):
            st.session_state[f"editing_account"] = acc.id
        if acc.is_active:
            if col4.button("🗑️", key=f"deact_{acc.id}"):
                deactivate_account(acc.id)
                st.rerun()

    # Inline edit form
    editing_id = st.session_state.get("editing_account")
    if editing_id:
        acc = next((a for a in accounts if a.id == editing_id), None)
        if acc:
            st.divider()
            st.subheader(f"Editing: {acc.name}")
            types = ["bank", "credit_card", "wallet", "investment"]

            with st.form("edit_account_form"):
                col1, col2 = st.columns(2)
                with col1:
                    new_name = st.text_input("Name", value=acc.name)
                    new_type = st.selectbox("Type", types, index=types.index(acc.account_type) if acc.account_type in types else 0, format_func=lambda x: x.replace("_", " ").title())
                    new_institution = st.text_input("Institution", value=acc.institution or "")
                with col2:
                    new_balance = st.number_input("Balance ($)", value=acc.balance, step=100.0)
                    new_credit_limit = st.number_input("Credit Limit ($)", value=acc.credit_limit or 0.0, step=1000.0)
                    new_active = st.checkbox("Active", value=acc.is_active)

                col_save, col_cancel = st.columns(2)
                with col_save:
                    if st.form_submit_button("Save", type="primary", use_container_width=True):
                        update_account(
                            acc.id,
                            name=new_name,
                            account_type=new_type,
                            institution=new_institution or None,
                            balance=new_balance,
                            credit_limit=new_credit_limit if new_credit_limit > 0 else None,
                            is_active=new_active,
                        )
                        del st.session_state["editing_account"]
                        st.success(f"Updated '{new_name}'!")
                        st.rerun()
                with col_cancel:
                    if st.form_submit_button("Cancel", use_container_width=True):
                        del st.session_state["editing_account"]
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
        credit_limit = st.number_input("Credit Limit ($ - for credit cards)", value=0.0, step=1000.0)

        if st.form_submit_button("Add Account", type="primary", use_container_width=True):
            if not name:
                st.error("Name required.")
            else:
                create_account(
                    name=name,
                    account_type=account_type,
                    institution=institution or None,
                    balance=balance,
                    credit_limit=credit_limit if credit_limit > 0 else None,
                )
                st.success(f"Added '{name}'!")
                st.rerun()
