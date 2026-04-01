from __future__ import annotations

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import AIService

router = APIRouter()
service = AIService()


class CommandRequest(BaseModel):
    command: str
    context: Optional[str] = None


@router.post("/command")
def process_command(request: CommandRequest):
    return service.process_command(request.command, request.context)
