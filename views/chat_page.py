"""Chat page - Ask AI about your finances."""

import streamlit as st
from src.llm import chat, check_ollama_status


def render():
    st.title("🤖 Ask AI")
    st.caption("Chat with your local Finance Minister AI. All data stays on your machine.")

    status = check_ollama_status()
    if not status["online"]:
        st.warning(f"Ollama offline. Run: `ollama serve`\n\nError: {status.get('error')}")
        return

    if not status.get("model_available"):
        st.warning(f"Model `{status['configured_model']}` not found. Run: `ollama pull {status['configured_model']}`")
        return

    st.success(f"Connected — {status['configured_model']}")

    if "chat_messages" not in st.session_state:
        st.session_state.chat_messages = []

    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if not st.session_state.chat_messages:
        suggestions = ["How much did I spend this month?", "Am I saving enough?", "What are my biggest expenses?", "Compare this month to last"]
        cols = st.columns(2)
        for i, s in enumerate(suggestions):
            with cols[i % 2]:
                if st.button(s, key=f"sug_{i}", use_container_width=True):
                    st.session_state._pending = s
                    st.rerun()

    pending = st.session_state.pop("_pending", None)
    user_input = st.chat_input("Ask about your finances...")
    if pending:
        user_input = pending

    if user_input:
        st.session_state.chat_messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                history = [{"role": m["role"], "content": m["content"]} for m in st.session_state.chat_messages[:-1]]
                response = chat(user_input, conversation_history=history)
            st.markdown(response)

        st.session_state.chat_messages.append({"role": "assistant", "content": response})

    if st.session_state.chat_messages:
        if st.button("Clear Chat"):
            st.session_state.chat_messages = []
            st.rerun()
