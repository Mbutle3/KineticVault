from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from services.ai_service import AIService
from services.tts_service import get_tts_status, openai_tts_configured, synthesize_openai_audio

router = APIRouter()
service = AIService()


class CommandRequest(BaseModel):
    command: str
    context: Optional[str] = None
    current_folder: Optional[str] = None
    active_file_path: Optional[str] = None


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50_000)


@router.post("/command")
def process_command(request: CommandRequest):
    return service.process_command(
        request.command,
        request.context,
        current_folder=request.current_folder,
        active_file_path=request.active_file_path,
    )


@router.get("/tts/status")
def tts_status():
    return get_tts_status()


@router.post("/tts")
def tts_speak(request: TtsRequest):
    if not openai_tts_configured():
        raise HTTPException(
            status_code=503,
            detail="Cloud TTS is not configured. Set OPENAI_API_KEY in server/.env or use browser Read aloud.",
        )
    try:
        audio, media_type = synthesize_openai_audio(request.text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500] if exc.response is not None else str(exc)
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI TTS request failed: {detail}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"TTS network error: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return Response(content=audio, media_type=media_type)
