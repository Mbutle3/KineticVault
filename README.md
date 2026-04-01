# The Kinetic Vault

A hybrid AI-powered file explorer. React + Vite frontend, Python FastAPI backend, monospace dark theme with `#00ff88` accent.

```
kinetic-vault/
├── client/          # React + Vite
└── server/          # Python FastAPI
```

---

## Prerequisites

- Node.js 18+
- Python 3.11+

---

## Setup & Run

### 1. Backend (FastAPI)

```bash
cd server
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API runs at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

### 2. Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

App runs at `http://localhost:5173`

Vite proxies all `/api/*` requests to the FastAPI server automatically.

---

## API Reference

| Method | Endpoint               | Description                           |
|--------|------------------------|---------------------------------------|
| GET    | `/api/files`           | List directory — `?path=<abs-path>`   |
| GET    | `/api/files/read`      | Read file contents — `?path=<abs-path>` |
| DELETE | `/api/files`           | Delete file/folder — `?path=<abs-path>` |
| POST   | `/api/files/rename`    | Rename — body: `{old_path, new_name}` |
| POST   | `/api/ai/command`      | AI command — body: `{command, context?}` |

---

## AI Integration (TODO)

`server/services/ai_service.py` contains a stub with full instructions for wiring in the Claude API:

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```

Then follow the TODO comments in `ai_service.py`.

---

## Tech Stack

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | React 18, Vite 5                  |
| Syntax HL | react-syntax-highlighter (Prism)  |
| Backend   | FastAPI, Uvicorn                  |
| Language  | Python 3.11+, Node 18+            |
| Font      | JetBrains Mono (Google Fonts)     |
