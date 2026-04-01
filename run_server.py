"""Launcher for the Kinetic Vault FastAPI server (used by .claude/launch.json)."""
import sys
import os

SERVER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "server")
sys.path.insert(0, SERVER_DIR)
os.chdir(SERVER_DIR)

import uvicorn

uvicorn.run("main:app", host="0.0.0.0", port=8000)
