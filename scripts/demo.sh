#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Kinetic Vault demo setup =="

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm (Node 18+) is required." >&2
  exit 1
fi

echo
echo "-- Installing JS deps"
npm install
cd client && npm install && cd ..

echo
echo "-- Starting MOCK UI only (Ctrl+C to stop)"
echo "This mode does NOT start FastAPI and does NOT touch your filesystem."
echo "Tip: for the real app, set KV_API_TOKEN in server/.env and run: npm run dev"
echo
VITE_MOCK_MODE=1 npm run dev:web

