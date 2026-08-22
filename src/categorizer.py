"""Automatic transaction categorization — keywords + LLM fallback."""

from typing import Optional

from src.database import get_session, Category


CATEGORY_KEYWORDS = {
    "Groceries": [
        "grocery", "supermarket", "whole foods", "trader joe", "costco",
        "walmart", "target", "kroger", "safeway", "publix", "aldi",
        "king soopers", "sprouts", "heb", "wegmans", "instacart",
    ],
    "Dining": [
        "restaurant", "cafe", "doordash", "grubhub", "ubereats", "food",
        "pizza", "burger", "starbucks", "mcdonald", "domino", "chipotle",
        "chick-fil-a", "panera", "subway", "taco bell", "wendy",
        "dunkin", "panda express", "denny", "ihop", "applebee",
    ],
    "Transport": [
        "uber", "lyft", "fuel", "gas", "shell", "chevron", "exxon",
        "bp", "parking", "toll", "transit", "metro", "amtrak",
        "southwest", "united", "delta", "american air",
    ],
    "Utilities": [
        "electric", "water", "gas bill", "internet", "wifi", "comcast",
        "xfinity", "verizon", "at&t", "t-mobile", "spectrum",
        "pg&e", "duke energy", "con edison",
    ],
    "Rent/Mortgage": [
        "rent", "mortgage", "lease", "housing", "apartment", "zillow",
    ],
    "Healthcare": [
        "hospital", "doctor", "pharmacy", "medical", "health", "clinic",
        "cvs", "walgreens", "rite aid", "labcorp", "quest diagnostics",
        "dental", "vision", "urgent care",
    ],
    "Entertainment": [
        "netflix", "hulu", "disney+", "hbo", "spotify", "movie",
        "theatre", "theater", "gaming", "steam", "playstation", "xbox",
        "concert", "ticketmaster", "amc", "regal",
    ],
    "Shopping": [
        "amazon", "target", "walmart", "best buy", "costco",
        "nordstrom", "macy", "tj maxx", "marshalls", "home depot",
        "lowes", "ikea", "etsy", "ebay",
    ],
    "Subscriptions": [
        "subscription", "membership", "premium", "annual",
        "monthly", "recurring", "apple.com/bill", "google storage",
    ],
    "Education": [
        "course", "udemy", "coursera", "book", "tuition", "school",
        "college", "university", "chegg", "skillshare",
    ],
    "Travel": [
        "hotel", "airbnb", "booking.com", "expedia", "marriott",
        "hilton", "trip", "vacation", "travel", "airlines",
    ],
    "Insurance": [
        "insurance", "premium", "geico", "state farm", "allstate",
        "progressive", "liberty mutual",
    ],
    "Personal Care": [
        "salon", "spa", "haircut", "grooming", "beauty", "gym",
        "fitness", "planet fitness", "equinox", "yoga",
    ],
    "Gifts": [
        "gift", "donation", "charity", "present", "gofundme",
    ],
    "Salary": ["salary", "payroll", "direct deposit", "wages"],
    "Freelance": ["freelance", "consulting", "client payment", "invoice", "1099"],
    "Interest": ["interest", "apy", "savings interest"],
    "Dividends": ["dividend", "payout", "distribution"],
    "Stocks": ["stock", "share", "equity", "robinhood", "fidelity", "schwab", "webull"],
    "Mutual Funds": ["mutual fund", "vanguard", "blackrock", "fund"],
    "ETFs": ["etf", "index fund", "spy", "qqq", "voo"],
    "Crypto": ["crypto", "bitcoin", "ethereum", "coinbase", "binance"],
    "401k/IRA": ["401k", "ira", "roth", "retirement", "contribution"],
}


def categorize_transaction(description: str) -> Optional[int]:
    """Auto-categorize via keywords, then LLM fallback."""
    if not description:
        return None

    desc_lower = description.lower()
    best_match = None
    best_score = 0

    for category_name, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in desc_lower:
                score = len(keyword)
                if score > best_score:
                    best_score = score
                    best_match = category_name

    if best_match:
        session = get_session()
        category = session.query(Category).filter(Category.name == best_match).first()
        session.close()
        if category:
            return category.id

    # Fallback: LLM categorization
    return _llm_categorize(description)


def _llm_categorize(description: str) -> Optional[int]:
    """Use local LLM to categorize when keywords fail."""
    import requests
    from src.config import get_llm_config

    config = get_llm_config()
    base_url = config["base_url"]
    model = config["model"]

    session = get_session()
    categories = session.query(Category).all()
    cat_names = [c.name for c in categories]
    cat_map = {c.name.lower(): c.id for c in categories}
    session.close()

    prompt = f"""Categorize this bank transaction into exactly one category.

Transaction: "{description}"

Categories: {', '.join(cat_names)}

Reply with ONLY the category name, nothing else."""

    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.1, "num_predict": 20},
            },
            timeout=10,
        )
        if response.status_code != 200:
            return None

        answer = response.json().get("response", "").strip().lower().rstrip(".")
        if answer in cat_map:
            return cat_map[answer]

        for cat_name_lower, cat_id in cat_map.items():
            if cat_name_lower in answer or answer in cat_name_lower:
                return cat_id

        return None
    except Exception:
        return None


def categorize_batch_llm(descriptions: list) -> dict:
    """Categorize multiple transactions at once via LLM."""
    import requests
    from src.config import get_llm_config

    config = get_llm_config()
    base_url = config["base_url"]
    model = config["model"]

    session = get_session()
    categories = session.query(Category).all()
    cat_names = [c.name for c in categories]
    cat_map = {c.name.lower(): c.id for c in categories}
    session.close()

    results = {}
    batch_size = 15

    for i in range(0, len(descriptions), batch_size):
        batch = descriptions[i:i + batch_size]
        numbered = "\n".join(f"{j+1}. {d}" for j, d in enumerate(batch))

        prompt = f"""Categorize each transaction into one of these categories:
{', '.join(cat_names)}

Transactions:
{numbered}

Reply with ONLY the number and category, one per line. Example:
1. Dining
2. Groceries"""

        try:
            response = requests.post(
                f"{base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 200},
                },
                timeout=30,
            )
            if response.status_code != 200:
                continue

            answer = response.json().get("response", "")
            for line in answer.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                parts = line.split(".", 1) if "." in line else line.split(":", 1)
                if len(parts) == 2:
                    try:
                        idx = int(parts[0].strip()) - 1
                        cat_name = parts[1].strip().lower().rstrip(".")
                        if 0 <= idx < len(batch) and cat_name in cat_map:
                            results[batch[idx]] = cat_map[cat_name]
                    except (ValueError, IndexError):
                        continue
        except Exception:
            continue

    return results


def get_category_suggestions(description: str, top_n: int = 3) -> list:
    """Get top N category suggestions for a transaction description."""
    if not description:
        return []

    desc_lower = description.lower()
    scores = {}

    for category_name, keywords in CATEGORY_KEYWORDS.items():
        category_score = 0
        for keyword in keywords:
            if keyword in desc_lower:
                category_score += len(keyword)
        if category_score > 0:
            scores[category_name] = category_score

    sorted_categories = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

    session = get_session()
    suggestions = []
    for cat_name, score in sorted_categories:
        category = session.query(Category).filter(Category.name == cat_name).first()
        if category:
            suggestions.append({
                "id": category.id,
                "name": category.name,
                "icon": category.icon,
                "type": category.category_type,
            })
    session.close()
    return suggestions


def get_all_categories(category_type: Optional[str] = None) -> list:
    session = get_session()
    query = session.query(Category)
    if category_type:
        query = query.filter(Category.category_type == category_type)
    categories = query.order_by(Category.category_type, Category.name).all()
    session.close()
    return categories
