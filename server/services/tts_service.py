from __future__ import annotations

import os
import threading
from typing import Any

import httpx

# OpenAI Speech API: https://platform.openai.com/docs/guides/text-to-speech
OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_INPUT_MAX = 4096

_VALID_VOICES = frozenset(
    {
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "fable",
        "onyx",
        "nova",
        "sage",
        "shimmer",
        "verse",
        "marin",
        "cedar",
    }
)
_VALID_MODELS = frozenset({"tts-1", "tts-1-hd", "gpt-4o-mini-tts", "gpt-4o-mini-tts-2025-12-15"})
_VALID_FORMATS = frozenset({"mp3", "opus", "aac", "flac", "wav", "pcm"})
_FORMAT_MEDIA_TYPES = {
    "mp3": "audio/mpeg",
    "opus": "audio/ogg",
    "aac": "audio/aac",
    "flac": "audio/flac",
    "wav": "audio/wav",
    "pcm": "audio/pcm",
}

# One shared client: reuses TLS + TCP to OpenAI (much faster than a new Client per request).
_tts_http_client: httpx.Client | None = None
_tts_http_init_lock = threading.Lock()
_tts_http_post_lock = threading.Lock()


def _get_tts_http_client() -> httpx.Client:
    global _tts_http_client
    if _tts_http_client is not None:
        return _tts_http_client
    with _tts_http_init_lock:
        if _tts_http_client is None:
            _tts_http_client = httpx.Client(
                timeout=httpx.Timeout(120.0, connect=30.0),
                limits=httpx.Limits(
                    max_keepalive_connections=20,
                    max_connections=100,
                    keepalive_expiry=120.0,
                ),
            )
    return _tts_http_client


def _response_format_and_mime() -> tuple[str, str]:
    # Default mp3 for broad <audio> support; set OPENAI_TTS_FORMAT=opus for smaller payloads (often faster end-to-end).
    fmt = (os.getenv("OPENAI_TTS_FORMAT") or "mp3").strip().lower()
    if fmt not in _VALID_FORMATS:
        fmt = "mp3"
    return fmt, _FORMAT_MEDIA_TYPES[fmt]


def openai_tts_configured() -> bool:
    return bool((os.getenv("OPENAI_API_KEY") or "").strip())


def get_tts_status() -> dict[str, Any]:
    """Safe for the client: no secrets."""
    if not openai_tts_configured():
        return {"enabled": False, "provider": None}
    voice = (os.getenv("OPENAI_TTS_VOICE") or "alloy").strip().lower()
    if voice not in _VALID_VOICES:
        voice = "alloy"
    model = (os.getenv("OPENAI_TTS_MODEL") or "tts-1").strip()
    if model not in _VALID_MODELS:
        model = "tts-1"
    fmt, mime = _response_format_and_mime()
    return {
        "enabled": True,
        "provider": "openai",
        "voice": voice,
        "model": model,
        "format": fmt,
        "media_type": mime,
    }


def synthesize_openai_audio(text: str) -> tuple[bytes, str]:
    """Return (audio bytes, Content-Type). Raises httpx.HTTPError on API failure."""
    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    raw = (text or "").strip()
    if not raw:
        raise ValueError("Text is empty")

    if len(raw) > OPENAI_INPUT_MAX:
        raw = raw[: OPENAI_INPUT_MAX - 1] + "…"

    voice = (os.getenv("OPENAI_TTS_VOICE") or "alloy").strip().lower()
    if voice not in _VALID_VOICES:
        voice = "alloy"
    model = (os.getenv("OPENAI_TTS_MODEL") or "tts-1").strip()
    if model not in _VALID_MODELS:
        model = "tts-1"
    response_format, media_type = _response_format_and_mime()

    client = _get_tts_http_client()
    # httpx.Client is not meant for concurrent posts from multiple threads; serialize TTS calls.
    with _tts_http_post_lock:
        r = client.post(
            OPENAI_SPEECH_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "input": raw,
                "voice": voice,
                "response_format": response_format,
            },
        )
        r.raise_for_status()
        content = r.content

    return content, media_type
