"""Background jobs API with progress tracking."""

import asyncio
import threading
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional

from src.database import get_session, Transaction, Category
from src.config import get_llm_config
from src.job_tracker import categorization_status, reset_status, update_progress, mark_done, add_failed

router = APIRouter()


def _run_recategorize(scope: str, account_id: Optional[int] = None):
    """Background thread for re-categorization."""
    import requests
    from datetime import datetime
    from src.database import JobRun

    session = get_session()
    config = get_llm_config()

    query = session.query(Transaction).filter(Transaction.description != None)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if scope == "uncategorized":
        query = query.filter(Transaction.category_id == None)

    targets = query.all()

    if not targets:
        mark_done()
        session.close()
        return

    reset_status("reevaluate", len(targets))

    # Create job run record
    job_run = JobRun(
        source="reevaluate",
        scope=scope,
        total=len(targets),
        model=config.get("model"),
        started_at=datetime.utcnow(),
    )
    session.add(job_run)
    session.commit()
    job_run_id = job_run.id

    all_cats = session.query(Category).all()
    cat_names = [c.name for c in all_cats]
    cat_map = {c.name.lower(): c.id for c in all_cats}

    import re
    batch_size = 15
    updated = 0
    failed = 0

    for i in range(0, len(targets), batch_size):
        batch = targets[i:i + batch_size]
        descriptions = [t.description for t in batch]
        numbered = "\n".join(f"{j+1}. {d}" for j, d in enumerate(descriptions))
        batch_matched = [False] * len(batch)  # track which items got categorized

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
                json={"model": config["model"], "prompt": prompt, "stream": False, "options": {"temperature": 0.1, "num_predict": 400}},
                timeout=60,
            )
            if response.status_code == 200:
                answer = response.json().get("response", "")
                for line in answer.strip().split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    m = re.match(r"^\s*(\d+)\s*[.):-]\s*(.+)$", line)
                    if not m:
                        continue
                    try:
                        idx = int(m.group(1)) - 1
                        raw_cat = m.group(2).strip().rstrip(".").strip()
                        cat_lower = raw_cat.lower()
                        matched_id = None
                        if cat_lower in cat_map:
                            matched_id = cat_map[cat_lower]
                        else:
                            for cname_lower, cid in cat_map.items():
                                if cname_lower in cat_lower or cat_lower in cname_lower:
                                    matched_id = cid
                                    break
                        if matched_id and 0 <= idx < len(batch):
                            batch[idx].category_id = matched_id
                            batch_matched[idx] = True
                            updated += 1
                    except (ValueError, IndexError):
                        continue
        except Exception:
            pass

        # Record failures for this batch
        for j, matched in enumerate(batch_matched):
            if not matched:
                failed += 1
                add_failed(batch[j].description or "(no description)", batch[j].amount)

        update_progress(min(i + batch_size, len(targets)), updated, failed)

    # Update job run record with final results
    jr = session.query(JobRun).filter(JobRun.id == job_run_id).first()
    if jr:
        jr.updated = updated
        jr.failed = failed
        jr.finished_at = datetime.utcnow()

    session.commit()
    session.close()
    mark_done()


@router.post("/recategorize")
def start_recategorize(scope: str = "uncategorized", account_id: Optional[int] = None):
    if categorization_status.get("running"):
        return {"error": "Job already running"}

    thread = threading.Thread(target=_run_recategorize, args=(scope, account_id), daemon=True)
    thread.start()
    return {"started": True}


@router.get("/recategorize/status")
def recategorize_status():
    return categorization_status


@router.get("/categorization/status")
def categorization_progress():
    """Get current categorization progress (from import or re-evaluate)."""
    return categorization_status


@router.get("/history")
def job_history(limit: int = 20):
    """Get history of past categorization runs."""
    from src.database import JobRun
    session = get_session()
    runs = session.query(JobRun).order_by(JobRun.started_at.desc()).limit(limit).all()
    result = [
        {
            "id": r.id,
            "source": r.source,
            "scope": r.scope,
            "total": r.total,
            "updated": r.updated,
            "failed": r.failed,
            "model": r.model,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        }
        for r in runs
    ]
    session.close()
    return result


@router.websocket("/ws/progress")
async def ws_progress(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(categorization_status)
            if categorization_status.get("done"):
                break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
