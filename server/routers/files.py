from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services.file_service import FileService

router = APIRouter()
service = FileService()


class RenameRequest(BaseModel):
    old_path: str
    new_name: str


@router.get("")
def list_directory(path: str = Query(..., description="Absolute path to directory")):
    return service.list_directory(path)


@router.get("/read")
def read_file(path: str = Query(..., description="Absolute path to file")):
    return service.read_file(path)


@router.delete("")
def delete_path(path: str = Query(..., description="Absolute path to file or folder")):
    return service.delete_path(path)


@router.post("/rename")
def rename_path(request: RenameRequest):
    return service.rename_path(request.old_path, request.new_name)
