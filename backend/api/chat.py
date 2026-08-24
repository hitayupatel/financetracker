"""Chat API endpoint for LLM interaction."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from src.llm import chat, check_ollama_status, get_quick_insight

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    history: Optional[list] = None


@router.get("/status")
def status():
    return check_ollama_status()


@router.get("/insight")
def insight():
    return {"insight": get_quick_insight()}


@router.post("/")
def send_message(data: ChatMessage):
    response = chat(data.message, conversation_history=data.history)
    return {"response": response}
