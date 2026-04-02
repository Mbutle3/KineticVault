import os
import time
from pathlib import Path

from dotenv import load_dotenv

# Load env before routers/services read os.environ.
# Repo root `.env` first, then `server/.env` (wins) so keys work in either location.
_server_dir = Path(__file__).resolve().parent
_repo_root = _server_dir.parent
load_dotenv(_repo_root / ".env")
load_dotenv(_server_dir / ".env", override=True)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import files, ai

app = FastAPI(title="Kinetic Vault API", version="0.1.0")

def _cors_origins() -> list[str]:
    raw = (os.getenv("KV_CORS_ORIGINS") or "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    return ["http://localhost:5173"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

_API_TOKEN = (os.getenv("KV_API_TOKEN") or "").strip()
_REQUIRE_TOKEN = (os.getenv("KV_REQUIRE_TOKEN") or "1").strip() not in ("0", "false", "False", "no", "NO")
_AI_RPM = int((os.getenv("KV_AI_RATE_LIMIT_PER_MIN") or "60").strip() or "60")
_AI_WINDOW_SEC = 60.0
_ai_counters: dict[str, tuple[float, int]] = {}

if _REQUIRE_TOKEN and not _API_TOKEN:
    raise RuntimeError(
        "Kinetic Vault safety check: KV_API_TOKEN is required to start the real API. "
        "Set KV_API_TOKEN in server/.env. For insecure local-only dev, set KV_REQUIRE_TOKEN=0."
    )


@app.middleware("http")
async def kv_security_middleware(request: Request, call_next):
    # Optional auth guard (for safety if someone accidentally exposes the port).
    if _API_TOKEN and request.url.path.startswith("/api/"):
        token = request.headers.get("x-kv-token") or request.headers.get("authorization", "")
        token = token.removeprefix("Bearer ").strip()
        if token != _API_TOKEN:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid KV_API_TOKEN"},
            )

    # Cost guard for AI endpoints (simple per-IP per-minute limit).
    if _AI_RPM > 0 and request.url.path.startswith("/api/ai/"):
        if request.url.path in ("/api/ai/tts/status",):
            return await call_next(request)
        now = time.monotonic()
        key = request.client.host if request.client else "unknown"
        reset_at, count = _ai_counters.get(key, (now + _AI_WINDOW_SEC, 0))
        if now > reset_at:
            reset_at, count = now + _AI_WINDOW_SEC, 0
        count += 1
        _ai_counters[key] = (reset_at, count)
        if count > _AI_RPM:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limited (KV_AI_RATE_LIMIT_PER_MIN)"},
            )

    return await call_next(request)


@app.get("/")
def root():
    return {"message": "Kinetic Vault API is running"}


if __name__ == "__main__":
    import uvicorn
    host = (os.getenv("KV_BIND_HOST") or "127.0.0.1").strip() or "127.0.0.1"
    port = int((os.getenv("KV_PORT") or "8000").strip() or "8000")
    uvicorn.run("main:app", host=host, port=port, reload=True)
