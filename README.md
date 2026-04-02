# The Kinetic Vault

A hybrid **AI-ready file explorer**: React + Vite UI, FastAPI filesystem API, monospace typography, **light/dark** themes with a **neutral** palette (charcoal / white / cool gray), resizable panels, and optional ambient visuals.

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
| **Help** | FAQ / help modal from header. |
| **Ambient** | Optional **Three.js** particle layer (lazy-loaded); off when **Reduce motion** is on. |

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

## API Reference — AI (stub)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/command` | Body `{ command, context? }` — see `server/services/ai_service.py`. |

---

## AI Integration (TODO)

`server/services/ai_service.py` is a stub with notes for wiring **Claude** (or similar):

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```

Follow the TODOs in `ai_service.py`.

---

## Configuration & tooling

- **CORS**: `server/main.py` allows `http://localhost:5173`.
- **Vite proxy**: `client/vite.config.js` targets `http://127.0.0.1:8000` for `/api` (avoids IPv6 `::1` mismatch).
- **Git**: `.claire/` and `.claude/worktrees/` are ignored (IDE worktree copies). **`node_modules/`** is ignored everywhere—do not commit it; run `npm install` locally. Commit **`package-lock.json`** at the repo root (and in `client/`) for reproducible installs, not the `node_modules` tree.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite 5 |
| Graphics | three.js (optional ambient layer) |
| Backend | FastAPI, Uvicorn, Pydantic v2 |
| Font | JetBrains Mono (loaded in CSS) |
