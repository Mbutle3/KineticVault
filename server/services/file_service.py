from __future__ import annotations

import shutil
from pathlib import Path
from fastapi import HTTPException


class FileService:
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
        p = Path(old_path)
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {old_path}")

        # Reject path traversal in new_name
        if "/" in new_name or "\\" in new_name:
            raise HTTPException(status_code=400, detail="new_name must be a plain filename, not a path")

        new_path = p.parent / new_name
        if new_path.exists():
            raise HTTPException(status_code=409, detail=f"Name already exists: {new_name}")

        try:
            p.rename(new_path)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")

        return {"message": f"Renamed to {new_name}", "new_path": str(new_path)}
