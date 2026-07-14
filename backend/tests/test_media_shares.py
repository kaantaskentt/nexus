"""Mid-interview media share by-token API."""

import base64
import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.media_storage import clear_memory_store
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _mint_session(db, ws, *, kind="interview", token="tok-media-1"):
    return await db.fetchval(
        """insert into interview_sessions
             (workspace_id, modality, status, session_kind, invite_token)
           values ($1, 'text', 'active', $2, $3) returning id""",
        ws, kind, token,
    )


PNG_1X1 = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
    )
).decode()


async def test_create_file_share_and_list_status_only(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    await _mint_session(db, ws, token="tok-a")

    # Skip real extract in this API test — just assert enqueue + status shape.
    async def no_op_job(payload):
        return None

    from app.pipeline import media_share as ms
    monkeypatch.setattr(ms, "extract_media_share", no_op_job)

    # Don't wait for worker — create with content enqueues; run extract sync stubbed
    # by patching enqueue to capture, then leave status extracting.
    jobs = []

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        jobs.append((kind, payload))
        return 1

    monkeypatch.setattr("app.routers.media.enqueue", capture_enqueue)

    async with _client() as c:
        r = await c.post(
            "/api/media/by-token/tok-a",
            json={
                "kind": "file",
                "file_name": "sheet.png",
                "file_mime": "image/png",
                "content_base64": PNG_1X1,
            },
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "extracting"
    assert body["file_name"] == "sheet.png"
    assert "extraction_text" not in body
    assert "storage_uri" not in body
    assert jobs and jobs[0][0] == "extract_media_share"

    async with _client() as c:
        listed = await c.get("/api/media/by-token/tok-a")
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 1
    assert set(rows[0].keys()) >= {"id", "kind", "status", "file_name", "byte_size"}
    assert "extraction_text" not in rows[0]
    assert "storage_uri" not in rows[0]


async def test_unknown_token_404(db):
    async with _client() as c:
        r = await c.get("/api/media/by-token/does-not-exist")
    assert r.status_code == 404


async def test_discard_before_ready_ok_after_ready_refused(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    sid = await _mint_session(db, ws, token="tok-b")

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        return 1

    monkeypatch.setattr("app.routers.media.enqueue", capture_enqueue)

    async with _client() as c:
        r = await c.post(
            "/api/media/by-token/tok-b",
            json={
                "kind": "screenshot",
                "file_name": "a.png",
                "file_mime": "image/png",
                "content_base64": PNG_1X1,
            },
        )
        share_id = r.json()["id"]
        d = await c.post(f"/api/media/by-token/tok-b/{share_id}/discard")
    assert d.status_code == 200
    assert d.json()["status"] == "discarded"

    # Force ready and refuse discard
    await db.execute(
        "update media_shares set status = 'ready' where session_id = $1", sid,
    )
    share2 = await db.fetchval(
        """insert into media_shares (workspace_id, session_id, kind, status, file_name, mime)
           values ($1,$2,'file','ready','x.png','image/png') returning id""",
        ws, sid,
    )
    async with _client() as c:
        bad = await c.post(f"/api/media/by-token/tok-b/{share2}/discard")
    assert bad.status_code == 409


async def test_isolation_other_session_share_404(db, monkeypatch):
    clear_memory_store()
    ws = await make_workspace(db)
    await _mint_session(db, ws, token="tok-c")
    await _mint_session(db, ws, token="tok-d")

    async def capture_enqueue(kind, payload, priority=100, delay_seconds=0):
        return 1

    monkeypatch.setattr("app.routers.media.enqueue", capture_enqueue)

    async with _client() as c:
        r = await c.post(
            "/api/media/by-token/tok-c",
            json={
                "kind": "file",
                "file_name": "a.png",
                "file_mime": "image/png",
                "content_base64": PNG_1X1,
            },
        )
        share_id = r.json()["id"]
        cross = await c.post(f"/api/media/by-token/tok-d/{share_id}/complete")
    assert cross.status_code == 404


async def test_roleplay_firewall(db):
    clear_memory_store()
    ws = await make_workspace(db)
    await _mint_session(db, ws, kind="roleplay", token="tok-rp")
    async with _client() as c:
        r = await c.post(
            "/api/media/by-token/tok-rp",
            json={
                "kind": "file",
                "file_name": "a.png",
                "file_mime": "image/png",
                "content_base64": PNG_1X1,
            },
        )
    assert r.status_code == 403


async def test_rejects_bad_mime(db):
    clear_memory_store()
    ws = await make_workspace(db)
    await _mint_session(db, ws, token="tok-mime")
    async with _client() as c:
        r = await c.post(
            "/api/media/by-token/tok-mime",
            json={
                "kind": "file",
                "file_name": "x.exe",
                "file_mime": "application/x-msdownload",
                "content_base64": PNG_1X1,
            },
        )
    assert r.status_code == 422
