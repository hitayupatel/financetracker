"""Shared background job status tracker."""

# Global job status — shared across imports and re-categorization
categorization_status = {
    "running": False,
    "progress": 0,
    "total": 0,
    "updated": 0,
    "done": False,
    "source": "",  # "import" or "reevaluate"
}


def reset_status(source: str, total: int):
    categorization_status["running"] = True
    categorization_status["progress"] = 0
    categorization_status["total"] = total
    categorization_status["updated"] = 0
    categorization_status["done"] = False
    categorization_status["source"] = source


def update_progress(progress: int, updated: int):
    categorization_status["progress"] = progress
    categorization_status["updated"] = updated


def mark_done():
    categorization_status["running"] = False
    categorization_status["done"] = True
