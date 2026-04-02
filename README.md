# The Kinetic Vault

A hybrid **AI-ready file explorer**: React + Vite UI, FastAPI filesystem API, monospace typography, **light/dark** themes, resizable panels, and optional ambient visuals.

**Look & feel:** UI chrome uses **soft neutral grays** (light: white panels on `#f1f3f4`; dark: lifted charcoal around `#454545` / `#505050`—not a heavy blue wash). **Google-style accents** (blue / **deep red** “Kinetic” in the header / green / yellow for states) appear in the wordmark, links, and status colors. **Dark mode** uses **high-contrast white** copy in the file list, sidebar, command bar, and empty/preview placeholders so breadcrumbs, table text, and AI chrome stay readable.

```
kinetic-vault/
├── package.json     # root: `npm run dev` runs API + Vite (concurrently)
├── client/          # React + Vite (port 5173)
└── server/          # Python FastAPI (port 8000)
```

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.9+ (3.11+ recommended)

---

## Setup & Run

The Vite dev server **proxies** `/api/*` to **`http://127.0.0.1:8000`**. If you only run `npm run dev` inside `client/` and see **`ECONNREFUSED`**, start the API first—or use **Option A** from the repo root.

### Option A — API + UI together (recommended)

From the **repository root**:

```bash
cd server && python3 -m pip install -r requirements.txt && cd ..
npm install
npm run dev
```

This starts **Uvicorn** and **Vite** in parallel. `dev:api` uses your default `python3`; use a venv if you prefer, and ensure that interpreter has the server requirements installed.

### Option B — two terminals

**Terminal 1 — Backend**

```bash
cd server
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`

**Terminal 2 — Frontend**

```bash
cd client
npm install
npm run dev
```

- App: `http://localhost:5173`

---

## Features (UI)

| Area | Behavior |
|------|----------|
| **Sidebar** | Home, Documents, Trash (OS-aware), **pinned** items, **project** tree (repo + optional `archive`). Pins persist in `~/.kineticvault/pins.json`. |
| **File list** | Sortable-style table; **clickable breadcrumbs**; row select + **context menu**. |
| **Context menu** | Open, Edit, Rename, Copy path, **Pin / Unpin**, **Duplicate**, Delete; on folders: **New file inside…**; on list background: **New file…**. |
| **Search** | Header search over names under **current folder** or **home** when no folder is open. |
| **Preview** | **Text**: editable buffer, **debounced save** + **⌘/Ctrl+S** flush. **PDF** / **images**: served via `/api/files/raw` in an iframe or `<img>`. Other binaries: download / open links. **Expand** control widens preview (hides file list until toggled or **Esc**). |
| **Layout** | **Resizable** sidebar, preview column, and command bar height (persisted in `localStorage`). |
| **Settings** | Theme, text size, **reduce motion** (disables ambient layer), focus/contrast options. |
| **Help** | In-app **user guide** (FAQ + getting started) from the header; points to this README for setup and APIs. |
| **Ambient** | Optional **Three.js** particle layer (lazy-loaded); neutral gray specks; off when **Reduce motion** is on. |
| **Command bar (AI)** | Quick actions (**recent / largest files**) use **local scans**. **Summarize** and free-form prompts use **Claude** when `ANTHROPIC_API_KEY` is set. The backend can attach **read-only directory listings** (e.g. Documents, current folder) so the model can describe folders accurately. **Formatted** replies, **clickable** file paths in results, **voice input** (Web Speech API), **Read aloud** (OpenAI TTS when `OPENAI_API_KEY` is set, else browser speech with preferred system voices), **RUN** / Enter to send. |
| **Breadcrumbs** | **Windows** drive paths: segment index matches path depth (no off-by-one under `C:`). |

---

## API Reference — Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/home` | Sidebar context: `home`, `documents`, `trash`, `media`, `pinned`, `projects`, etc. |
| GET | `/api/files/pinned` | List pinned items. |
| POST | `/api/files/pinned` | Body `{ path, name? }` — pin path. |
| DELETE | `/api/files/pinned?path=…` | Unpin. |
| GET | `/api/files` | List directory — `?path=<abs-path>`. |
| GET | `/api/files/search` | Substring name search — `q`, optional `root`, `limit` (1–2000). |
| GET | `/api/files/read` | UTF-8 text — `?path=<abs-file>`. |
| GET | `/api/files/raw` | Stream file bytes + `Content-Type` — `?path=<abs-file>` (PDF/images use `inline` disposition for preview). |
| DELETE | `/api/files?path=…` | Delete file or folder. |
| POST | `/api/files/rename` | Body `{ old_path, new_name }` — plain filename only. |
| POST | `/api/files/create` | Body `{ parent_path, name }` — empty file. |
| POST | `/api/files/write` | Body `{ path, content }` — overwrite UTF-8 text. |
| POST | `/api/files/duplicate` | Body `{ path }` — copy as `name copy`, `name copy 2`, … |

---

## API Reference — AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/command` | Body `{ command, context?, current_folder?, active_file_path? }` — see `server/services/ai_service.py`. |
| GET | `/api/ai/tts/status` | JSON: whether cloud TTS is enabled (`OPENAI_API_KEY`), provider id, voice/model (no secrets). |
| POST | `/api/ai/tts` | Body `{ text }` (string, max 50k chars; truncated server-side for the provider). Returns audio bytes (`Content-Type` from `OPENAI_TTS_FORMAT`, default `audio/mpeg`) when OpenAI TTS is configured; otherwise **503**. |

---

## AI integration (Claude)

Quick actions (recent / largest files) stay **local**. With an API key, **free-form commands** and **Summarize this file** use **Claude** via the Anthropic API.

1. Copy `server/.env.example` to **`server/.env`** (or edit the generated `server/.env`).
2. Set `ANTHROPIC_API_KEY=sk-ant-api03-...` from [Anthropic Console](https://console.anthropic.com/).
3. Optional: set `CLAUDE_MODEL` to a model id your key supports (default is set in `ai_service.py`).
4. Reinstall server deps and restart the API:

```bash
cd server && pip install -r requirements.txt && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

`main.py` loads `server/.env` automatically; `.env` is gitignored.

**Folder-aware answers:** For prompts about Documents, Desktop, Downloads, home, or vague “describe this folder” questions, the server injects **directory listings** (names only) into the Claude prompt so replies reflect your disk. Your **current folder** from the UI is included when relevant.

---

## Cloud text-to-speech (Read aloud)

**What we recommend (implemented): [OpenAI Text-to-Speech](https://platform.openai.com/docs/guides/text-to-speech)** — One HTTPS call returns MP3 audio; models **`tts-1`** (faster) and **`tts-1-hd`** (richer) are supported. Quality is strong for UI narration, setup is minimal (API key only), and billing is per character. **Read aloud** sends **only the stripped reply text** to OpenAI when cloud TTS is enabled.

**Alternatives (not wired in this repo):**

| Provider | Notes |
|----------|--------|
| **Google Cloud Text-to-Speech** | Neural2 / WaveNet / Journey; GCP project + service account; excellent language coverage. |
| **Amazon Polly** | Neural / generative voices; fits AWS-centric deployments. |
| **Azure AI Speech** | Neural voices, SSML, enterprise controls. |
| **ElevenLabs** | Very expressive; higher cost; separate integration. |

**Configuration**

1. Set `OPENAI_API_KEY` in `server/.env` (see `server/.env.example`).
2. Optional: `OPENAI_TTS_MODEL` (`tts-1`, `tts-1-hd`, or `gpt-4o-mini-tts`), `OPENAI_TTS_VOICE` (see OpenAI TTS docs; includes `alloy`, `nova`, `coral`, …). **`OPENAI_TTS_FORMAT`**: `opus` often yields a **smaller file and quicker time-to-play** than `mp3` on modern browsers; use `mp3` if audio fails to play.
3. Restart the API. The backend **reuses one HTTP connection** to OpenAI (keep-alive), so **repeat Read aloud** requests skip a full TLS handshake and usually start noticeably sooner than the first call in a session.
4. The client calls `GET /api/ai/tts/status` and prefers cloud audio when `enabled` is true; if the request fails or the key is absent, **Read aloud** falls back to the **browser Web Speech API** (with best-effort voice selection).

**Latency note:** The first cloud TTS in a session still waits on OpenAI to synthesize the full clip; `tts-1` is faster than `tts-1-hd`. True streaming playback (audio before the full file finishes) needs different models/API options and is not wired here yet.

---

## Configuration & tooling

- **CORS**: `server/main.py` allows `http://localhost:5173`.
- **Vite proxy**: `client/vite.config.js` targets `http://127.0.0.1:8000` for `/api` (avoids IPv6 `::1` mismatch).
- **Default theme**: **Light** on first visit unless `localStorage` has `kv-theme=dark`.
- **Git**: `.claire/` and `.claude/worktrees/` are ignored (IDE worktree copies). **`node_modules/`** is ignored everywhere—do not commit it; run `npm install` locally. Commit **`package-lock.json`** at the repo root (and in `client/`) for reproducible installs, not the `node_modules` tree.
- **Secrets**: Put keys in **`server/.env`** or the **repository root** `.env` (both are gitignored). If both exist, **`server/.env` wins**. Restart the API after changing env vars so Uvicorn reload picks them up.

### Frontend implementation notes (recent)

- **File search**: `onError` is a **stable** callback and `FileSearch` keeps the latest handler in a **ref** so open dropdowns do not re-fire `/api/files/search` on unrelated parent re-renders (e.g. panel resize).
- **Command bar TTS**: Cloud path fetches audio from `POST /api/ai/tts` (mp3/opus/etc.); playback uses an `Audio` element with blob URLs. The API reuses a keep-alive HTTP client to OpenAI. Browser path uses `speechSynthesis` with ranked voice choice when `getVoices()` is populated.
- **Styles**: See `client/src/index.css` for theme tokens (`:root` / `[data-theme="light"]`) and dark-mode white-text overrides for list, sidebar, and command bar.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5 |
| Graphics | three.js (optional ambient layer) |
| Backend | FastAPI, Uvicorn, Pydantic v2, httpx (OpenAI TTS) |
| Font | JetBrains Mono (loaded in CSS) |
