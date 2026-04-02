from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from services.file_service import FileService

router = APIRouter()
service = FileService()


@router.get("/home")
def home_context():
    """Absolute paths for common folders (Documents, Trash, etc.)."""
    return service.home_context()


class RenameRequest(BaseModel):
    old_path: str
    new_name: str


class PinRequest(BaseModel):
    path: str
    name: Optional[str] = None


class CreateFileRequest(BaseModel):
    parent_path: str
    name: str


class WriteFileRequest(BaseModel):
    path: str
    content: str


class DuplicateRequest(BaseModel):
    path: str


@router.get("/pinned")
def get_pinned():
    return service.list_pins()


@router.post("/pinned")
def add_pin(request: PinRequest):
    return service.add_pin(request.path, request.name)


@router.delete("/pinned")
def remove_pin(path: str = Query(..., description="Absolute path to unpin")):
    return service.remove_pin(path)


@router.get("")
def list_directory(path: str = Query(..., description="Absolute path to directory")):
    return service.list_directory(path)


@router.get("/search")
def search_files(
    q: str = Query("", description="Substring to match against file/folder names"),
    root: str = Query("", description="Directory to search under; defaults to user home"),
    limit: int = Query(200, ge=1, le=2000, description="Max results"),
):
    r = root.strip() if root else None
    default_root = str(Path.home())
    return service.search_files(q, r or default_root, limit)


@router.get("/read")
def read_file(path: str = Query(..., description="Absolute path to file")):
    return service.read_file(path)


@router.get("/raw")
def raw_file(path: str = Query(..., description="Absolute path to file")):
    return service.raw_file_response(path)


@router.delete("")
def delete_path(path: str = Query(..., description="Absolute path to file or folder")):
    return service.delete_path(path)


@router.post("/rename")
def rename_path(request: RenameRequest):
    return service.rename_path(request.old_path, request.new_name)


@router.post("/create")
def create_file(request: CreateFileRequest):
    return service.create_file(request.parent_path, request.name)


@router.post("/write")
def write_file(request: WriteFileRequest):
    return service.write_file(request.path, request.content)


@router.post("/duplicate")
def duplicate_path(request: DuplicateRequest):
    return service.duplicate_path(request.path)
