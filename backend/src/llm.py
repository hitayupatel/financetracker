"""Local LLM integration via Ollama for Finance Minister."""

from datetime import date
from typing import Optional

import requests

from src.config import get_llm_config
from src.analytics import get_financial_summary_text, get_overview
from src.accounts import get_all_accounts, get_net_worth
from src.transactions import get_spending_trend


SYSTEM_PROMPT = """You are Finance Minister, a personal finance AI assistant. You help the user understand their spending habits, income, savings, and investments.

Rules:
- Always reference actual numbers from the data provided.
- Use US Dollar ($) for amounts.
- Be honest if spending is high or savings are low.
- Suggest actionable improvements when relevant.
- Keep responses concise but insightful.
"""


def _build_context() -> str:
    today = date.today()
    year, month = today.year, today.month
    sections = []

    try:
        summary = get_financial_summary_text(year, month)
        sections.append(summary)
    except Exception:
        pass

    try:
        accounts = get_all_accounts()
        if accounts:
            sections.append("\nAccount Balances:")
            for acc in accounts:
                sections.append(f"  {acc.name} ({acc.account_type}): ${acc.balance:,.2f}")
    except Exception:
        pass

    try:
        nw = get_net_worth()
        sections.append(f"\nNet Worth: ${nw['net_worth']:,.2f}")
        sections.append(f"  Assets: ${nw['total_assets']:,.2f}")
        sections.append(f"  Liabilities: ${nw['total_liabilities']:,.2f}")
    except Exception:
        pass

    try:
        trends = get_spending_trend(months=3)
        if trends:
            sections.append("\nMonthly Trends (last 3 months):")
            for t in trends:
                sections.append(
                    f"  {t['year']}-{t['month']:02d}: "
                    f"Income ${t['income']:,.0f} | "
                    f"Expense ${t['expense']:,.0f} | "
                    f"Saved ${t['income'] - t['expense']:,.0f}"
                )
    except Exception:
        pass

    return "\n".join(sections)


def check_ollama_status() -> dict:
    config = get_llm_config()
    base_url = config["base_url"]
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=5)
        if response.status_code != 200:
            return {"online": False, "error": "Ollama not responding"}
        models = response.json().get("models", [])
        model_names = [m.get("name", "").split(":")[0] for m in models]
        model_available = config["model"].split(":")[0] in model_names
        return {
            "online": True,
            "model_available": model_available,
            "configured_model": config["model"],
            "available_models": model_names,
        }
    except requests.ConnectionError:
        return {"online": False, "error": "Cannot connect to Ollama. Is it running?"}
    except Exception as e:
        return {"online": False, "error": str(e)}


def chat(user_message: str, conversation_history: Optional[list] = None) -> str:
    config = get_llm_config()
    base_url = config["base_url"]
    model = config["model"]
    temperature = config.get("temperature", 0.3)

    context = _build_context()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\n--- YOUR FINANCIAL DATA ---\n" + context},
    ]
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    try:
        response = requests.post(
            f"{base_url}/api/chat",
            json={"model": model, "messages": messages, "stream": False, "options": {"temperature": temperature}},
            timeout=120,
        )
        if response.status_code != 200:
            return f"Error from Ollama (HTTP {response.status_code}): {response.text}"
        return response.json().get("message", {}).get("content", "No response from model.")
    except requests.ConnectionError:
        return f"Cannot connect to Ollama. Run: ollama serve && ollama pull {model}"
    except requests.Timeout:
        return "Request timed out. Try again."
    except Exception as e:
        return f"Error: {str(e)}"


def get_quick_insight() -> str:
    today = date.today()
    try:
        overview = get_overview(today.year, today.month)
    except Exception:
        return ""

    if overview["transaction_count"] == 0:
        return ""

    insights = []
    if overview["savings_rate"] > 30:
        insights.append(f"Great savings rate of {overview['savings_rate']:.0f}%!")
    elif overview["savings_rate"] > 0:
        insights.append(f"Savings rate: {overview['savings_rate']:.0f}%. Aim for 30%+.")
    else:
        insights.append("Spending more than earning this month.")

    insights.append(f"Averaging ${overview['avg_daily_expense']:,.0f}/day in expenses.")
    return " | ".join(insights)
