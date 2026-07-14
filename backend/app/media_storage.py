"""Private media blob store for mid-interview shares.

Prod: Supabase Storage bucket (service role). Tests: in-memory backend via
MEDIA_STORAGE_BACKEND=memory. Raw files are retained after extract — this module
exposes put/get only; no delete on the happy path.
"""

from __future__ import annotations

import logging

import httpx

from .config import get_settings

log = logging.getLogger(__name__)

_MEMORY: dict[str, bytes] = {}


class MediaStorageError(RuntimeError):
    pass


def storage_path(workspace_id: str, session_id: str, share_id: str, file_name: str) -> str:
    safe = (file_name or "blob").replace("/", "_").replace("\\", "_")[:200]
    return f"{workspace_id}/{session_id}/{share_id}/{safe}"


def _backend() -> str:
    return (get_settings().media_storage_backend or "supabase").strip().lower()


async def put_bytes(path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Write bytes; returns the storage_uri (path key). Never deletes prior objects."""
    if not data:
        raise MediaStorageError("empty blob")
    backend = _backend()
    if backend == "memory":
        _MEMORY[path] = data
        return path
    if backend != "supabase":
        raise MediaStorageError(f"unknown media_storage_backend: {backend}")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise MediaStorageError(
            "Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    bucket = settings.media_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": content_type or "application/octet-stream",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, content=data, headers=headers)
        if resp.status_code not in (200, 201):
            raise MediaStorageError(
                f"Supabase Storage upload failed ({resp.status_code}): {resp.text[:300]}"
            )
    return path


async def get_bytes(path: str) -> bytes:
    backend = _backend()
    if backend == "memory":
        if path not in _MEMORY:
            raise MediaStorageError(f"missing blob: {path}")
        return _MEMORY[path]
    if backend != "supabase":
        raise MediaStorageError(f"unknown media_storage_backend: {backend}")
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise MediaStorageError(
            "Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    bucket = settings.media_storage_bucket
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            raise MediaStorageError(
                f"Supabase Storage download failed ({resp.status_code}): {resp.text[:300]}"
            )
        return resp.content


def delete_bytes(path: str) -> None:
    """Intentionally unused on the extract happy path — raw files are retained.
    Exposed only so tests can assert it is never called after a successful extract."""
    raise MediaStorageError("raw media delete is disabled — files are retained after extract")


def clear_memory_store() -> None:
    _MEMORY.clear()
