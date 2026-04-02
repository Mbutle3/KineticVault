from __future__ import annotations

import json
import mimetypes
from typing import Optional
import os
import shutil
import sys
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse


class FileService:
    @staticmethod
    def _repo_root() -> Path:
        # server/services/file_service.py -> repo root (parent of server/)
        return Path(__file__).resolve().parent.parent.parent

    def home_context(self) -> dict:
        """Resolved paths for sidebar shortcuts (OS-aware)."""
        home = Path.home()
        h = str(home)
        if sys.platform == "darwin":
            trash = str(home / ".Trash")
            media = str(home / "Movies")
            system = "/System"
        elif sys.platform == "win32":
            trash = str(home)
            media = str(home / "Videos")
            system = None
        else:
            trash = str(home / ".local" / "share" / "Trash" / "files")
            media = str(home / "Videos")
            system = "/usr"

        out: dict = {
            "home": h,
            "documents": str(home / "Documents"),
            "media": media,
            "trash": trash,
        }
        if system:
            out["system"] = system

        out["pinned"] = self.list_pins()

        repo = self._repo_root()
        projects: list[dict] = []
        if repo.is_dir():
            children: list[dict] = []
            for sub, name in ((repo / "client", "client"), (repo / "server", "server")):
                if sub.is_dir():
                    children.append({"name": name, "path": str(sub)})
            projects.append(
                {
                    "name": repo.name,
                    "path": str(repo),
                    "expanded": True,
                    "children": children,
                }
            )
            parent = repo.parent
            archive = parent / "archive"
            if archive.is_dir():
                projects.append(
                    {
                        "name": "archive",
                        "path": str(archive),
                        "expanded": False,
                        "children": [],
                    }
                )
        out["projects"] = projects

        return out

    # --- Pinned items (~/.kineticvault/pins.json) ---

    def _pins_dir(self) -> Path:
        d = Path.home() / ".kineticvault"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _pins_file(self) -> Path:
        return self._pins_dir() / "pins.json"

    def _default_pin_store(self) -> list[dict]:
        repo = self._repo_root()
        out: list[dict] = []
        if not repo.is_dir():
            return out
        for label, rel in (
            ("README.md", "README.md"),
            ("package.json", "client/package.json"),
            ("main.py", "server/main.py"),
        ):
            f = (repo / rel).resolve()
            if f.is_file():
                out.append({"path": str(f), "name": label})
        return out

    def _ensure_pins_store(self) -> None:
        path = self._pins_file()
        if not path.exists():
            path.write_text(
                json.dumps(self._default_pin_store(), indent=2),
                encoding="utf-8",
            )

    def _read_pin_store(self) -> list[dict]:
        self._ensure_pins_store()
        raw = self._pins_file().read_text(encoding="utf-8").strip()
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []
        return [x for x in data if isinstance(x, dict) and x.get("path")]

    def _write_pin_store(self, entries: list[dict]) -> None:
        clean = [{"path": str(e["path"]), "name": str(e.get("name") or Path(e["path"]).name)} for e in entries]
        self._pins_file().write_text(json.dumps(clean, indent=2), encoding="utf-8")

    def _materialize_pins(self, entries: list[dict]) -> tuple[list[dict], list[dict]]:
        """Returns (api_items, cleaned_store_rows)."""
        api: list[dict] = []
        kept: list[dict] = []
        for e in entries:
            try:
                p = Path(e["path"]).expanduser().resolve()
            except OSError:
                continue
            if not p.exists():
                continue
            name = (e.get("name") or p.name).strip() or p.name
            kept.append({"path": str(p), "name": name})
            api.append({
                "path": str(p),
                "name": name,
                "kind": "folder" if p.is_dir() else "file",
            })
        api.sort(key=lambda x: (x["kind"] == "file", x["name"].lower()))
        return api, kept

    def list_pins(self) -> list[dict]:
        entries = self._read_pin_store()
        api, kept = self._materialize_pins(entries)
        self._write_pin_store(kept)
        return api

    def add_pin(self, path: str, name: Optional[str] = None) -> list[dict]:
        self._ensure_pins_store()
        try:
            p = Path(path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {path}") from exc
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")

        display = (name or p.name).strip() or p.name
        entries = self._read_pin_store()
        resolved_existing = set()
        for e in entries:
            try:
                resolved_existing.add(str(Path(e["path"]).expanduser().resolve()))
            except OSError:
                continue
        if str(p) in resolved_existing:
            raise HTTPException(status_code=409, detail="Already pinned")

        entries.append({"path": str(p), "name": display})
        self._write_pin_store(entries)
        return self.list_pins()

    def remove_pin(self, path: str) -> list[dict]:
        self._ensure_pins_store()
        try:
            target = Path(path).expanduser().resolve()
        except OSError:
            return self.list_pins()

        entries = self._read_pin_store()
        new_entries: list[dict] = []
        for e in entries:
            try:
                ep = Path(e["path"]).expanduser().resolve()
            except OSError:
                continue
            if ep != target:
                new_entries.append(e)
        self._write_pin_store(new_entries)
        return self.list_pins()

    # Skip during search — keeps common trees fast and avoids permission noise.
    _SEARCH_SKIP_DIRS = frozenset({
        "node_modules",
        ".git",
        "__pycache__",
        ".Trash",
        ".npm",
        ".yarn",
        "venv",
        ".venv",
        "dist",
        "build",
        ".next",
        ".turbo",
        "target",
    })

    def search_files(self, query: str, root: str, limit: int = 200) -> list[dict]:
        """Recursive filename substring match (case-insensitive) under root."""
        needle = query.strip().lower()
        if not needle:
            return []

        root_path = Path(root).expanduser().resolve()
        if not root_path.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {root}")
        if not root_path.is_dir():
            raise HTTPException(status_code=400, detail="Root must be a directory")

        results: list[dict] = []
        root_str = str(root_path)

        def on_walk_error(_err):
            pass

        sort_key = lambda x: (x["type"] == "file", x["name"].lower())

        for dirpath, dirnames, filenames in os.walk(
            root_str, topdown=True, onerror=on_walk_error, followlinks=False
        ):
            dirnames[:] = [d for d in dirnames if d not in self._SEARCH_SKIP_DIRS]

            # Collect folder and file matches in this directory first, then merge.
            # Otherwise hitting `limit` while iterating only dirnames returns before
            # filenames in the *same* directory are considered (incomplete results).
            batch: list[dict] = []

            for name in dirnames:
                if needle not in name.lower():
                    continue
                fp = Path(dirpath) / name
                try:
                    if fp.is_dir():
                        stat = fp.stat()
                        batch.append({
                            "name": name,
                            "type": "folder",
                            "size": None,
                            "modified": stat.st_mtime,
                            "path": str(fp),
                        })
                except (OSError, PermissionError):
                    continue

            for name in filenames:
                if needle not in name.lower():
                    continue
                fp = Path(dirpath) / name
                try:
                    if fp.is_file():
                        stat = fp.stat()
                        batch.append({
                            "name": name,
                            "type": "file",
                            "size": stat.st_size,
                            "modified": stat.st_mtime,
                            "path": str(fp),
                        })
                except (OSError, PermissionError):
                    continue

            batch.sort(key=sort_key)
            for item in batch:
                results.append(item)
                if len(results) >= limit:
                    return sorted(results, key=sort_key)

        return sorted(results, key=sort_key)

    def _empty_list_if_trash_denied(self, path: Path) -> bool:
        """macOS blocks enumerating ~/.Trash for normal processes; avoid 403."""
        if sys.platform != "darwin":
            return False
        home = Path.home()
        try:
            return path.resolve() == (home / ".Trash").resolve()
        except OSError:
            return False

    def list_directory(self, path: str) -> list[dict]:
        p = Path(path)
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
        if not p.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")

        entries = []
        try:
            for entry in p.iterdir():
                try:
                    stat = entry.stat()
                    entries.append({
                        "name": entry.name,
                        "type": "folder" if entry.is_dir() else "file",
                        "size": stat.st_size if entry.is_file() else None,
                        "modified": stat.st_mtime,
                        "path": str(entry),
                    })
                except (PermissionError, OSError):
                    # Skip unreadable entries rather than aborting the entire listing
                    continue
        except PermissionError:
            if self._empty_list_if_trash_denied(p):
                return []
            raise HTTPException(status_code=403, detail="Permission denied")

        # Folders first, then files; both sorted alphabetically (case-insensitive)
        return sorted(entries, key=lambda x: (x["type"] == "file", x["name"].lower()))

    def read_file(self, path: str) -> dict:
        p = Path(path)
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        if not p.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")

        try:
            content = p.read_text(encoding="utf-8", errors="replace")
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {"path": path, "name": p.name, "content": content}

    def raw_file_response(self, path: str) -> FileResponse:
        """Stream file bytes with a guessed Content-Type (PDF, images, etc.)."""
        try:
            p = Path(path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {path}") from exc

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        if not p.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")

        media_type, _ = mimetypes.guess_type(p.name)
        if not media_type:
            media_type = "application/octet-stream"

        ext = p.suffix.lower()
        if ext == ".pdf":
            media_type = "application/pdf"
        elif ext in (".jpg", ".jpeg"):
            media_type = "image/jpeg"
        elif ext == ".png":
            media_type = "image/png"
        elif ext == ".gif":
            media_type = "image/gif"
        elif ext == ".webp":
            media_type = "image/webp"
        elif ext == ".svg":
            media_type = "image/svg+xml"

        # Default FileResponse uses Content-Disposition: attachment, which forces
        # "Save as" and breaks <iframe> / <img> preview. Inline is correct for PDFs and images.
        disposition = "inline" if (
            media_type == "application/pdf" or media_type.startswith("image/")
        ) else "attachment"

        try:
            return FileResponse(
                path=str(p),
                media_type=media_type,
                filename=p.name,
                content_disposition_type=disposition,
            )
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

    def delete_path(self, path: str) -> dict:
        p = Path(path)
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")

        try:
            if p.is_file() or p.is_symlink():
                p.unlink()
            else:
                shutil.rmtree(p)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {"message": f"Deleted: {path}"}

    def rename_path(self, old_path: str, new_name: str) -> dict:
        try:
            p = Path(old_path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {old_path}") from exc

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {old_path}")

        raw = (new_name or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="new_name is required")
        if raw in (".", ".."):
            raise HTTPException(status_code=400, detail="Invalid file name")

        if "/" in raw or "\\" in raw:
            raise HTTPException(status_code=400, detail="new_name must be a plain filename, not a path")

        new_path = (p.parent / raw).resolve()
        try:
            new_path.relative_to(p.parent.resolve())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid file name")

        if new_path.exists():
            raise HTTPException(status_code=409, detail=f"Name already exists: {raw}")

        try:
            p.rename(new_path)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        except OSError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {"message": f"Renamed to {raw}", "new_path": str(new_path)}

    def create_file(self, parent_path: str, name: str) -> dict:
        """Create an empty file inside an existing directory."""
        try:
            parent = Path(parent_path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {parent_path}") from exc

        if not parent.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {parent_path}")
        if not parent.is_dir():
            raise HTTPException(status_code=400, detail="Parent must be a directory")

        raw = (name or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="File name is required")
        if "/" in raw or "\\" in raw:
            raise HTTPException(status_code=400, detail="Name must be a plain filename, not a path")
        if raw in (".", ".."):
            raise HTTPException(status_code=400, detail="Invalid file name")

        dest = (parent / raw).resolve()
        try:
            dest.relative_to(parent)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid file name")

        if dest.exists():
            raise HTTPException(status_code=409, detail=f"Already exists: {raw}")

        try:
            dest.touch(exist_ok=False)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        except FileExistsError:
            raise HTTPException(status_code=409, detail=f"Already exists: {raw}")

        return {"path": str(dest), "name": dest.name}

    def write_file(self, path: str, content: str) -> dict:
        """Overwrite file contents as UTF-8 text."""
        try:
            p = Path(path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {path}") from exc

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        if not p.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")

        try:
            p.write_text(content if content is not None else "", encoding="utf-8")
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {"path": str(p), "name": p.name}

    def duplicate_path(self, path: str) -> dict:
        """Copy a file or directory next to the original as `name copy` (+ numeric suffix if needed)."""
        try:
            p = Path(path).expanduser().resolve()
        except OSError as exc:
            raise HTTPException(status_code=404, detail=f"Path not found: {path}") from exc

        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")

        parent = p.parent

        def pick_dest_folder(base_name: str) -> Path:
            candidate = parent / f"{base_name} copy"
            if not candidate.exists():
                return candidate
            n = 2
            while True:
                c = parent / f"{base_name} copy {n}"
                if not c.exists():
                    return c
                n += 1

        def pick_dest_file(stem: str, suffix: str) -> Path:
            candidate = parent / f"{stem} copy{suffix}"
            if not candidate.exists():
                return candidate
            n = 2
            while True:
                c = parent / f"{stem} copy {n}{suffix}"
                if not c.exists():
                    return c
                n += 1

        try:
            if p.is_dir():
                dest = pick_dest_folder(p.name)
                shutil.copytree(p, dest, symlinks=True, dirs_exist_ok=False)
                return {"path": str(dest), "name": dest.name, "type": "folder"}

            dest = pick_dest_file(p.stem, p.suffix)
            shutil.copy2(p, dest, follow_symlinks=False)
            return {"path": str(dest), "name": dest.name, "type": "file"}
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        except FileExistsError:
            raise HTTPException(status_code=409, detail="Duplicate target already exists")
        except OSError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
