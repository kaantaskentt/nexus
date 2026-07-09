"""Artifact promises API (Kaan feature 1, July 8).

Respondent side (PUBLIC, token-gated like every by-token route): list your own
promises, upload the file — the done page renders both. Admin side (blanket
require_admin in main.py): promised-vs-delivered per session and the file download.
Auto-send reminders are PROPOSED, not built — the admin endpoint returns the data a
copyable reminder is composed from, and the frontend offers copy-to-clipboard only.

Files live in artifact_promises.file_bytes (bytea): zero new infra, one durability
story. Upload is base64 JSON (no multipart dependency), capped at 10 MB decoded."""

import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from ..auth import require_admin
from ..db import get_pool

router = APIRouter()

MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB — a document, not a video drop


async def _session_for_token(pool, token: str):
    row = await pool.fetchrow(
        """select id, workspace_id from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if row is None:
        raise HTTPException(404, "unknown or expired link")
    return row


# ── Respondent (public by-token) ─────────────────────────────────────────────

@router.get("/by-token/{token}")
async def list_for_respondent(token: str):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    rows = await pool.fetch(
        """select id, item, objective_context, status, file_name from artifact_promises
           where session_id = $1 order by created_at""",
        sess["id"],
    )
    # No quote here: the respondent already knows what they said; the done page keeps
    # it light. The file itself is never served back on the public route.
    return [
        {"id": str(r["id"]), "item": r["item"], "objective_context": r["objective_context"],
         "status": r["status"], "file_name": r["file_name"]}
        for r in rows
    ]


class UploadIn(BaseModel):
    file_name: str = Field(min_length=1, max_length=300)
    file_mime: str = Field(min_length=1, max_length=200)
    content_base64: str


@router.post("/by-token/{token}/{artifact_id}/upload")
async def upload(token: str, artifact_id: str, body: UploadIn):
    pool = await get_pool()
    sess = await _session_for_token(pool, token)
    try:
        blob = base64.b64decode(body.content_base64, validate=True)
    except Exception:
        raise HTTPException(422, "content_base64 is not valid base64")
    if not blob:
        raise HTTPException(422, "empty file")
    if len(blob) > MAX_FILE_BYTES:
        raise HTTPException(413, "file is larger than 10 MB")

    # Scoped to THIS session's promise — a valid artifact id from another session 404s.
    # Re-upload while promised (or even after delivery) replaces the file: the newest
    # version from its owner is the honest artifact.
    updated = await pool.fetchrow(
        """update artifact_promises
           set status = 'delivered', delivered_at = $3, file_name = $4, file_mime = $5,
               file_bytes = $6
           where id = $1 and session_id = $2
           returning id""",
        artifact_id, sess["id"], datetime.now(timezone.utc),
        body.file_name.strip(), body.file_mime.strip(), blob,
    )
    if updated is None:
        raise HTTPException(404, "no such promised item on this link")
    return {"ok": True, "id": str(updated["id"]), "status": "delivered"}


# ── Admin (blanket require_admin via main.py) ────────────────────────────────

@router.get("/{workspace_id}/sessions/{session_id}", dependencies=[Depends(require_admin)])
async def list_for_admin(workspace_id: str, session_id: str):
    pool = await get_pool()
    sess = await pool.fetchrow(
        """select s.id, s.invite_token, coalesce(se.canonical_name, pe.canonical_name) as interviewee
           from interview_sessions s
           left join entities se on se.id = s.interviewee_id
           left join interview_plans p on p.id = s.plan_id
           left join entities pe on pe.id = p.interviewee_id
           where s.id = $1 and s.workspace_id = $2""",
        session_id, workspace_id,
    )
    if sess is None:
        raise HTTPException(404, "session not found")
    rows = await pool.fetch(
        """select id, item, objective_context, quote, status, created_at, delivered_at,
                  file_name, file_mime, coalesce(length(file_bytes), 0) as file_size
           from artifact_promises where session_id = $1 order by created_at""",
        session_id,
    )
    return {
        "interviewee": sess["interviewee"],
        # The respondent's live link — what the copyable reminder points at.
        "invite_path": f"/i/{sess['invite_token']}" if sess["invite_token"] else None,
        "promises": [
            {"id": str(r["id"]), "item": r["item"], "objective_context": r["objective_context"],
             "quote": r["quote"], "status": r["status"],
             "created_at": r["created_at"].isoformat(),
             "delivered_at": r["delivered_at"].isoformat() if r["delivered_at"] else None,
             "file_name": r["file_name"], "file_mime": r["file_mime"],
             "file_size": r["file_size"]}
            for r in rows
        ],
    }


@router.get("/{workspace_id}/file/{artifact_id}", dependencies=[Depends(require_admin)])
async def download(workspace_id: str, artifact_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """select file_name, file_mime, file_bytes from artifact_promises
           where id = $1 and workspace_id = $2 and status = 'delivered'""",
        artifact_id, workspace_id,
    )
    if row is None or row["file_bytes"] is None:
        raise HTTPException(404, "no delivered file")
    safe_name = (row["file_name"] or "artifact").replace('"', "")
    return Response(
        content=bytes(row["file_bytes"]),
        media_type=row["file_mime"] or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
