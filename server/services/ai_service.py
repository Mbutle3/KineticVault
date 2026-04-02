from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from services.file_service import FileService

DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"

_SYSTEM = (
    "You are the Kinetic Vault file explorer assistant. The user is browsing their own machine "
    "(home directory and project folders). Reply concisely in plain text. You cannot delete, rename, "
    "or write files yourself—only describe steps or answer questions. If asked for destructive actions, "
    "warn them and suggest using the app UI. "
    "Formatting: put each section title on its own line starting with ## (one space after hashes). "
    "Leave one completely blank line between sections. Put each bullet on its own line, starting with "
    "- or • (never run bullets together on one line). "
    "IMPORTANT: The user message may include a section beginning with "
    '"--- Server-provided directory listings ---". That block contains real folder listings read from '
    "the user's disk by the Kinetic Vault backend (names of files and folders only). "
    "Use it to describe what is in those folders, answer questions about structure, and summarize contents. "
    "Never say you cannot access or browse their filesystem when that section includes listings. "
    "If a listing says empty, permission denied, or outside allowed workspace, explain that clearly."
)


def _anthropic_client():
    key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not key:
        return None
    try:
        from anthropic import Anthropic
    except ImportError:
        return None
    return Anthropic(api_key=key)


def _claude_model() -> str:
    return (os.getenv("CLAUDE_MODEL") or "").strip() or DEFAULT_CLAUDE_MODEL


def _message_text(response: Any) -> str:
    parts: list[str] = []
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) == "text" and getattr(block, "text", None):
            parts.append(block.text)
    return "\n".join(parts).strip() or "(No text in response)"


class AIService:
    def __init__(self) -> None:
        self._files = FileService()

    @staticmethod
    def _path_key(path: str | None) -> str | None:
        if not path:
            return None
        try:
            return str(Path(path).expanduser().resolve())
        except OSError:
            return path

    def _build_directory_context(self, command: str, current_folder: str | None) -> str:
        """Attach real directory listings so Claude can answer 'describe my Documents' etc."""
        cmd_l = (command or "").lower()
        blocks: list[str] = []
        seen: set[str] = set()

        def add_section(title: str, folder_path: str | None, limit: int = 120) -> None:
            if not folder_path:
                return
            key = self._path_key(folder_path)
            if not key or key in seen:
                return
            seen.add(key)
            listing = self._files.directory_listing_for_ai(folder_path, limit)
            blocks.append(f"### {title}\nPath: `{folder_path}`\n{listing}")

        hc = self._files.home_context()
        home = hc.get("home")
        documents = hc.get("documents")

        wants_documents = "document" in cmd_l
        wants_home = "home directory" in cmd_l or "home folder" in cmd_l or "my home" in cmd_l
        wants_desktop = "desktop" in cmd_l
        wants_downloads = "download" in cmd_l

        if current_folder:
            add_section("Folder currently open in Kinetic Vault", current_folder)

        if wants_documents and documents:
            add_section("User Documents folder", documents)

        if wants_home and home:
            add_section("User home directory (top level)", home, limit=100)

        if wants_desktop and home:
            add_section("Desktop", str(Path(home) / "Desktop"))

        if wants_downloads and home:
            add_section("Downloads", str(Path(home) / "Downloads"))

        vague_place = (
            "folder" in cmd_l
            or "directory" in cmd_l
            or "what's on" in cmd_l
            or "what is on" in cmd_l
            or "list" in cmd_l
            or "describe" in cmd_l
            or "show me" in cmd_l
        )
        if not blocks and vague_place:
            if current_folder:
                add_section("Folder currently open in Kinetic Vault", current_folder)
            if documents:
                add_section("User Documents folder", documents)
            elif home:
                add_section("User home directory (top level)", home, limit=80)

        if not blocks:
            return ""

        return (
            "--- Server-provided directory listings (read by Kinetic Vault from the user's machine; "
            "use this data in your answer) ---\n\n" + "\n\n".join(blocks)
        )

    def _claude_messages(self, user_content: str) -> str:
        client = _anthropic_client()
        if client is None:
            raise RuntimeError("Claude is not configured (missing ANTHROPIC_API_KEY or anthropic package).")

        msg = client.messages.create(
            model=_claude_model(),
            max_tokens=2048,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_content}],
        )
        return _message_text(msg)

    def process_command(
        self,
        command: str,
        context: str | None = None,
        *,
        current_folder: str | None = None,
        active_file_path: str | None = None,
    ) -> dict:
        normalized = command.strip().lower()

        if normalized == "find recent files" or self._is_find_recent(normalized):
            rows = self._files.ai_recent_files(current_folder=current_folder, limit=12)
            if not rows:
                return {
                    "action": "find_recent",
                    "message": "No files found in the scanned folders (repo, Documents, and your current folder when applicable).",
                    "result": None,
                }
            return {
                "action": "find_recent",
                "message": "Most recently modified files (click a row to open):",
                "result": rows,
            }

        if normalized == "show largest files" or self._is_show_largest(normalized):
            rows = self._files.ai_largest_files(current_folder=current_folder, limit=12)
            if not rows:
                return {
                    "action": "find_largest",
                    "message": "No files found in the scanned folders.",
                    "result": None,
                }
            return {
                "action": "find_largest",
                "message": "Largest files found (click to open):",
                "result": rows,
            }

        if normalized == "summarize this file" or self._is_summarize(normalized):
            path = (active_file_path or "").strip()
            if not path:
                return {
                    "action": "summarize",
                    "message": "Open a file in the preview first, or tell me which file to summarize.",
                    "result": None,
                }
            if _anthropic_client() is not None:
                try:
                    r = self._files.ai_read_text_for_prompt(path, max_chars=100_000)
                    if not r.get("ok"):
                        return {"action": "summarize", "message": r["message"], "result": None}
                    note = " (truncated for length)" if r.get("truncated") else ""
                    dir_ctx = self._build_directory_context("summarize open file context", current_folder)
                    user = (
                        f'Summarize the following file "{r["name"]}"{note}. '
                        "Give a short overview, then bullet key points.\n\n---\n\n"
                        f'{r["text"]}'
                    )
                    if dir_ctx:
                        user = f"{dir_ctx}\n\n---\n\n{user}"
                    text = self._claude_messages(user)
                    return {
                        "action": "summarize",
                        "message": text,
                        "result": None,
                    }
                except Exception as exc:
                    out = self._files.ai_summarize_file_local(path)
                    return {
                        "action": "summarize",
                        "message": f"Claude request failed ({exc}). {out['message']}",
                        "result": out["result"],
                    }
            out = self._files.ai_summarize_file_local(path)
            return {
                "action": "summarize",
                "message": out["message"],
                "result": out["result"],
            }

        if _anthropic_client() is not None and command.strip():
            try:
                dir_ctx = self._build_directory_context(command.strip(), current_folder)
                parts = [f"User command:\n{command.strip()}"]
                if context:
                    parts.insert(0, context)
                if current_folder:
                    parts.append(f"Current folder path: {current_folder}")
                if active_file_path:
                    parts.append(f"Active file: {active_file_path}")
                if dir_ctx:
                    parts.append(dir_ctx)
                text = self._claude_messages("\n\n".join(parts))
                return {"action": "claude", "message": text, "result": None}
            except Exception as exc:
                return {
                    "action": "claude_error",
                    "message": f"Claude error: {exc}",
                    "result": None,
                }

        return {
            "action": "echo",
            "message": (
                f'Received: "{command}". '
                "Try quick actions: find recent files, show largest files, summarize this file — "
                "or add `ANTHROPIC_API_KEY` to `server/.env` and `pip install -r requirements.txt`."
            ),
            "result": None,
        }

    @staticmethod
    def _is_find_recent(s: str) -> bool:
        return "recent" in s and "file" in s

    @staticmethod
    def _is_show_largest(s: str) -> bool:
        return ("largest" in s or "biggest" in s) and "file" in s

    @staticmethod
    def _is_summarize(s: str) -> bool:
        return "summar" in s
