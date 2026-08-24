"""Background jobs API with WebSocket progress."""

import asyncio
import threading
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from src.database import get_session, Transaction, Category
from src.config import get_llm_config

router = APIRouter()

# Job state
_job_status = {"running": False, "progress": 0, "total": 0, "updated": 0, "done": False}
_ws_clients = []


def _run_recategorize(scope: str, account_id: Optional[int] = None):
    """Background thread for re-categorization."""
    import requests

    global _job_status
    _job_status = {"running": True, "progress": 0, "total": 0, "updated": 0, "done": False}

    session = get_session()
    config = get_llm_config()

    # Get targets
    query = session.query(Transaction).filter(Transaction.description != None)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if scope == "uncategorized":
        query = query.filter(Transaction.category_id == None)

    targets = query.all()
    _job_status["total"] = len(targets)

    if not targets:
        _job_status["done"] = True
        _job_status["running"] = False
        session.close()
        return

    # Get categories
    all_cats = session.query(Category).all()
    cat_names = [c.name for c in all_cats]
    cat_map = {c.name.lower(): c.id for c in all_cats}

    batch_size = 15
    updated = 0

    for i in range(0, len(targets), batch_size):
        batch = targets[i:i + batch_size]
        descriptions = [t.description for t in batch]
        numbered = "\n".join(f"{j+1}. {d}" for j, d in enumerate(descriptions))

        prompt = f"""Categorize each transaction into one of these categories:
{', '.join(cat_names)}

Transactions:
{numbered}

Reply with ONLY the number and category, one per line. Example:
1. Dining
2. Groceries"""

        try:
            response = requests.post(
                f"{config['base_url']}/api/generate",
                json={"model": config["model"], "prompt": prompt, "stream": False, "options": {"temperature": 0.1, "num_predict": 200}},
                timeout=30,
            )
            if response.status_code == 200:
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
                                batch[idx].category_id = cat_map[cat_name]
                                updated += 1
                        except (ValueError, IndexError):
                            continue
        except Exception:
            pass

        _job_status["progress"] = min(i + batch_size, len(targets))
        _job_status["updated"] = updated

    session.commit()
    session.close()
    _job_status["done"] = True
    _job_status["running"] = False


@router.post("/recategorize")
def start_recategorize(scope: str = "uncategorized", account_id: Optional[int] = None):
    if _job_status.get("running"):
        return {"error": "Job already running"}

    thread = threading.Thread(target=_run_recategorize, args=(scope, account_id), daemon=True)
    thread.start()
    return {"started": True}


@router.get("/recategorize/status")
def recategorize_status():
    return _job_status


@router.websocket("/ws/progress")
async def ws_progress(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.append(websocket)
    try:
        while True:
            await websocket.send_json(_job_status)
            if _job_status.get("done"):
                break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)
