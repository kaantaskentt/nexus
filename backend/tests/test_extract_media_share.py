"""extract_media_share job — mocked vendors, CLAIMED compile enqueue, retain raw bytes."""

import base64
import json

import pytest

from app.media_storage import clear_memory_store, get_bytes, put_bytes, storage_path
from app.pipeline.media_share import extract_media_share, grounding_for_session
from tests.conftest import make_workspace

PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


async def _session(db, ws, token="tok-ex"):
    return await db.fetchval(
        """insert into interview_sessions
             (workspace_id, modality, status, session_kind, invite_token)
           values ($1, 'text', 'active', 'interview', $2) returning id""",
        ws, token,
    )


async def test_image_routes_to_claude_and_compiles(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    sid = await _session(db, ws)
    path = storage_path(str(ws), str(sid), "share-1", "ui.png")
    await put_bytes(path, PNG, "image/png")
    share_id = await db.fetchval(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime, byte_size, storage_uri)
           values ($1,$2,'screenshot','extracting','ui.png','image/png',$3,$4)
           returning id""",
        ws, sid, len(PNG), path,
    )

    called = {"claude": 0, "tl": 0, "delete": 0}

    async def fake_claude(**kw):
        called["claude"] += 1
        return {
            "summary": "Salesforce export screen with Export CSV.",
            "observations": ["Export CSV button visible", "Salesforce toolbar"],
            "tools_seen": ["Salesforce"],
        }

    async def fake_tl(**kw):
        called["tl"] += 1
        return {"summary": "should not run"}

    async def boom_delete(path):
        called["delete"] += 1
        raise AssertionError("raw media must not be deleted")

    jobs = []

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        jobs.append((kind, payload))
        return 99

    monkeypatch.setattr(
        "app.pipeline.media_share._extract_claude_document", fake_claude,
    )
    monkeypatch.setattr(
        "app.pipeline.media_share._extract_twelvelabs_screen", fake_tl,
    )
    monkeypatch.setattr("app.pipeline.media_share.enqueue", capture_enqueue)
    monkeypatch.setattr("app.media_storage.delete_bytes", boom_delete)

    await extract_media_share({"share_id": str(share_id)})

    row = await db.fetchrow("select * from media_shares where id = $1", share_id)
    assert row["status"] == "ready"
    assert "Salesforce" in (row["extraction_text"] or "")
    assert row["grounding_summary"]
    assert called["claude"] == 1 and called["tl"] == 0 and called["delete"] == 0
    # Raw blob still readable
    assert await get_bytes(path) == PNG
    assert jobs and jobs[0][0] == "compile_session"
    payload = jobs[0][1]
    assert payload["max_tag"] == "CLAIMED"
    assert row["compile_session_id"] is not None


async def test_video_routes_to_twelvelabs(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    sid = await _session(db, ws, token="tok-vid")
    path = storage_path(str(ws), str(sid), "share-v", "clip.webm")
    await put_bytes(path, b"fake-webm-bytes", "video/webm")
    share_id = await db.fetchval(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime, byte_size, storage_uri)
           values ($1,$2,'screen','extracting','clip.webm','video/webm',$3,$4)
           returning id""",
        ws, sid, 14, path,
    )

    async def fake_tl(**kw):
        return {
            "summary": "Opened Excel then exported CSV.",
            "observations": ["Excel workbook", "Export CSV"],
            "tools_seen": ["Excel"],
            "steps": ["Open file", "Export"],
        }

    async def fail_claude(**kw):
        raise AssertionError("claude should not run for screen")

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        return 1

    monkeypatch.setattr(
        "app.pipeline.media_share._extract_twelvelabs_screen", fake_tl,
    )
    monkeypatch.setattr(
        "app.pipeline.media_share._extract_claude_document", fail_claude,
    )
    monkeypatch.setattr("app.pipeline.media_share.enqueue", capture_enqueue)

    await extract_media_share({"share_id": str(share_id)})
    row = await db.fetchrow("select status, extraction_text from media_shares where id=$1", share_id)
    assert row["status"] == "ready"
    assert "Excel" in row["extraction_text"]


async def test_vendor_failure_no_compile(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    sid = await _session(db, ws, token="tok-fail")
    path = storage_path(str(ws), str(sid), "share-f", "x.png")
    await put_bytes(path, PNG, "image/png")
    share_id = await db.fetchval(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime, byte_size, storage_uri)
           values ($1,$2,'file','extracting','x.png','image/png',$3,$4) returning id""",
        ws, sid, len(PNG), path,
    )

    async def boom(**kw):
        raise RuntimeError("vendor down")

    jobs = []

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        jobs.append(kind)
        return 1

    monkeypatch.setattr("app.pipeline.media_share._extract_claude_document", boom)
    monkeypatch.setattr("app.pipeline.media_share.enqueue", capture_enqueue)

    await extract_media_share({"share_id": str(share_id)})
    row = await db.fetchrow("select status, error, compile_session_id from media_shares where id=$1", share_id)
    assert row["status"] == "failed"
    assert "vendor down" in (row["error"] or "")
    assert row["compile_session_id"] is None
    assert "compile_session" not in jobs


async def test_idempotent_ready_skip(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    sid = await _session(db, ws, token="tok-id")
    share_id = await db.fetchval(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime, grounding_summary)
           values ($1,$2,'file','ready','x.png','image/png','done') returning id""",
        ws, sid,
    )
    called = {"n": 0}

    async def fake(**kw):
        called["n"] += 1
        return {}

    monkeypatch.setattr("app.pipeline.media_share._extract_claude_document", fake)
    await extract_media_share({"share_id": str(share_id)})
    assert called["n"] == 0


async def test_grounding_for_session(db):
    ws = await make_workspace(db)
    sid = await _session(db, ws, token="tok-g")
    await db.execute(
        """insert into media_shares
             (workspace_id, session_id, kind, status, file_name, mime, grounding_summary)
           values ($1,$2,'file','ready','a.png','image/png','Uses Salesforce'),
                  ($1,$2,'file','extracting','b.png','image/png','should ignore')""",
        ws, sid,
    )
    block = await grounding_for_session(str(sid))
    assert block and "Salesforce" in block
    assert "should ignore" not in block
