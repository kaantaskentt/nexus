"""Mid-interview media shares (file / screenshot / screen) — PUBLIC by-token routes.

Respondent uploads on /i/{token}; status-only list never returns extraction text or
storage URLs (R1). Bytes go to private media storage; extract job compiles CLAIMED.
"""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..db import get_pool
from ..media_storage import MediaStorageError, put_bytes, storage_path
from ..queue import enqueue

log = logging.getLogger(__name__)
router = APIRouter()

# Screenshots / docs — generous but not a video drop.
MAX_FILE_BYTES = 15 * 1024 * 1024
# Short screen recordings (webm/mp4) for Twelve Labs.
MAX_SCREEN_BYTES = 100 * 1024 * 1024

ALLOWED_KINDS = frozenset({"file", "screenshot", "screen"})
IMAGE_PREFIXES = ("image/",)
DOC_MIMES = frozenset({
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})
VIDEO_PREFIXES = ("video/",)


async def _session_for_token(pool, token: str):
    row = await pool.fetchrow(
        """select id, workspace_id, session_kind, status from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if row is None:
        raise HTTPException(404, "unknown or expired link")
    return row


def _firewall_kind(session_kind: str | None) -> None:
    if session_kind in ("voice_test", "roleplay"):
        raise HTTPException(403, "media shares are not available on this session kind")


def _max_for(kind: str) -> int:
    return MAX_SCREEN_BYTES if kind == "screen" else MAX_FILE_BYTES


def _mime_ok(kind: str, mime: str) -> bool:
    m = (mime or "").lower().strip()
    if kind in ("file", "screenshot"):
        return m.startswith(IMAGE_PREFIXES) or m in DOC_MIMES or m.startswith("text/")
    if kind == "screen":
        return m.startswith(VIDEO_PREFIXES) or m in ("application/octet-stream",)
    return False


def _public_row(r) -> dict:
    # Status-only — never extraction_text, storage_uri, or grounding prose.
    return {
        "id": str(r["id"]),
        "kind": r["kind"],
        "status": r["status"],
        "file_name": r["file_name"],
        "byte_size": r["byte_size"],
        "error": r["error"] if r["status"] == "failed" else None,
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


@router.get("/by-token/{token}")
async def list_shares(token: str):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    rows = await pool.fetch(
        """select id, kind, status, file_name, byte_size, error, created_at
           from media_shares where session_id = $1
           and status != 'discarded'
           order by created_at""",
        sess["id"],
    )
    return [_public_row(r) for r in rows]


class CreateIn(BaseModel):
    kind: str
    file_name: str = Field(min_length=1, max_length=300)
    file_mime: str = Field(min_length=1, max_length=200)
    content_base64: str | None = None  # optional: present → store + extract immediately


@router.post("/by-token/{token}")
async def create_share(token: str, body: CreateIn):
    kind = (body.kind or "").strip().lower()
    if kind not in ALLOWED_KINDS:
        raise HTTPException(422, f"kind must be one of {sorted(ALLOWED_KINDS)}")
    mime = body.file_mime.strip()
    if not _mime_ok(kind, mime):
        raise HTTPException(422, f"unsupported mime for {kind}: {mime}")

    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    _firewall_kind(sess["session_kind"])

    row = await pool.fetchrow(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime)
           values ($1,$2,$3,'uploading',$4,$5)
           returning *""",
        sess["workspace_id"], sess["id"], kind, body.file_name.strip(), mime,
    )
    share_id = str(row["id"])

    if body.content_base64:
        return await _accept_bytes(
            pool, sess, row, body.content_base64, enqueue_extract=True,
        )
    return _public_row(row)


class UploadIn(BaseModel):
    content_base64: str
    append: bool = False  # True = concatenate to existing blob (chunked screen)


@router.post("/by-token/{token}/{share_id}/upload")
async def upload_share(token: str, share_id: str, body: UploadIn):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    _firewall_kind(sess["session_kind"])
    row = await pool.fetchrow(
        """select * from media_shares
           where id = $1 and session_id = $2""",
        share_id, sess["id"],
    )
    if row is None:
        raise HTTPException(404, "no such media share on this link")
    if row["status"] not in ("uploading", "failed"):
        raise HTTPException(409, f"cannot upload while status is {row['status']}")
    return await _accept_bytes(
        pool, sess, row, body.content_base64,
        enqueue_extract=False, append=body.append,
    )


@router.post("/by-token/{token}/{share_id}/complete")
async def complete_share(token: str, share_id: str):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    _firewall_kind(sess["session_kind"])
    row = await pool.fetchrow(
        """select * from media_shares where id = $1 and session_id = $2""",
        share_id, sess["id"],
    )
    if row is None:
        raise HTTPException(404, "no such media share on this link")
    if row["status"] == "ready":
        return _public_row(row)
    if row["status"] == "discarded":
        raise HTTPException(409, "share was discarded")
    if not row["storage_uri"] or row["byte_size"] <= 0:
        raise HTTPException(400, "upload the media before completing")

    updated = await pool.fetchrow(
        """update media_shares set status = 'extracting', error = null, updated_at = $2
           where id = $1 and session_id = $3
           returning id, kind, status, file_name, byte_size, error, created_at""",
        share_id, datetime.now(timezone.utc), sess["id"],
    )
    await enqueue("extract_media_share", {"share_id": share_id})
    return _public_row(updated)


@router.post("/by-token/{token}/{share_id}/discard")
async def discard_share(token: str, share_id: str):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    row = await pool.fetchrow(
        """select id, status from media_shares where id = $1 and session_id = $2""",
        share_id, sess["id"],
    )
    if row is None:
        raise HTTPException(404, "no such media share on this link")
    if row["status"] == "ready":
        raise HTTPException(409, "cannot discard after compile")
    updated = await pool.fetchrow(
        """update media_shares set status = 'discarded', updated_at = $2
           where id = $1
           returning id, kind, status, file_name, byte_size, error, created_at""",
        share_id, datetime.now(timezone.utc),
    )
    return _public_row(updated)


async def _accept_bytes(pool, sess, row, content_base64: str, *, enqueue_extract: bool, append: bool = False):
    try:
        blob = base64.b64decode(content_base64, validate=True)
    except Exception:
        raise HTTPException(422, "content_base64 is not valid base64")
    if not blob and not append:
        raise HTTPException(422, "empty file")

    kind = row["kind"]
    share_id = str(row["id"])
    max_bytes = _max_for(kind)
    prior = b""
    if append and row["storage_uri"]:
        from ..media_storage import get_bytes
        try:
            prior = await get_bytes(row["storage_uri"])
        except MediaStorageError:
            prior = b""
    data = prior + blob
    if len(data) > max_bytes:
        raise HTTPException(413, f"file is larger than {max_bytes} bytes")

    path = row.get("storage_uri") or storage_path(
        str(sess["workspace_id"]), str(sess["id"]), share_id, row["file_name"] or "blob",
    )
    try:
        uri = await put_bytes(path, data, content_type=row["mime"] or "application/octet-stream")
    except MediaStorageError as e:
        raise HTTPException(503, str(e)) from e

    status = "extracting" if enqueue_extract else "uploading"
    updated = await pool.fetchrow(
        """update media_shares
           set storage_uri = $2, byte_size = $3, status = $4, error = null, updated_at = $5
           where id = $1
           returning id, kind, status, file_name, byte_size, error, created_at""",
        share_id, uri, len(data), status, datetime.now(timezone.utc),
    )
    if enqueue_extract:
        await enqueue("extract_media_share", {"share_id": share_id})
    return _public_row(updated)
