"""Finance Minister - Personal Finance Dashboard."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st
from src.database import setup_database

setup_database()

st.set_page_config(
    page_title="Finance Minister",
    page_icon="🏛️",
    layout="wide",
)

# Sidebar navigation
st.sidebar.title("🏛️ Finance Minister")

page = st.sidebar.radio(
    "Go to",
    ["Overview", "Transactions", "Accounts", "Import", "Analytics", "Ask AI"],
)

if page == "Overview":
    from views.overview import render
    render()
elif page == "Transactions":
    from views.transactions_page import render
    render()
elif page == "Accounts":
    from views.accounts_page import render
    render()
elif page == "Import":
    from views.import_page import render
    render()
elif page == "Analytics":
    from views.analytics_page import render
    render()
elif page == "Ask AI":
    from views.chat_page import render
    render()
