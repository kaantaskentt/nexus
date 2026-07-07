"""Per-workspace voice settings (task #39). Asserts the config contract voice-room builds
against, the tenant-isolation rule (customizing never touches the shared defaults), and the
honest sync status when VAPI isn't configured. The VAPI push is monkeypatched — these tests
never reach the network."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers import voice_config
from app.vapi_assistant import DEFAULT_ASSISTANT_IDS
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _voice_session(db, ws, token):
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, invite_token, status) "
        "values ($1, 'voice', $2, 'pending') returning id",
        ws, token,
    )


async def test_default_config_is_shared_female_assistant(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.get(f"/api/voice-config/{ws}")
    assert r.status_code == 200
    body = r.json()
    # No row yet => global default = ElevenLabs 'ryan' (Kaan's July 7 casting pick, A20),
    # canned fast opener, not custom, not synced.
    assert body["gender"] == "M"
    assert body["voice_id"] == "ryan"
    assert body["assistant_id"] == DEFAULT_ASSISTANT_IDS["M"]
    assert body["is_custom"] is False
    assert body["vapi_synced"] is False
    assert body["first_message"] is None
    assert any(v["voice_id"] == "orion" for v in body["voices"])  # library travels for the picker


async def test_get_unknown_workspace_404(db):
    async with _client() as c:
        r = await c.get("/api/voice-config/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_put_without_vapi_key_saves_but_reports_not_live(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    monkeypatch.setattr(voice_config, "get_settings", lambda: _settings(vapi_api_key=""))
    async with _client() as c:
        r = await c.put(f"/api/voice-config/{ws}",
                        json={"voice_id": "orion", "speed": 1.2, "first_message": "  Hi, thanks for making time.  "})
    assert r.status_code == 200
    body = r.json()
    assert body["voice_id"] == "orion"
    assert body["gender"] == "M"            # gender derived from the chosen voice
    assert body["speed"] == 1.2
    assert body["first_message"] == "Hi, thanks for making time."  # trimmed
    assert body["is_custom"] is False        # no dedicated assistant created without a key
    assert body["assistant_id"] == DEFAULT_ASSISTANT_IDS["M"]  # falls back to shared male default
    assert body["vapi_synced"] is False
    assert body["sync_error"] is not None    # honest: saved but not live

    # Persisted.
    row = await db.fetchrow("select * from voice_configs where workspace_id = $1", ws)
    assert row["voice_id"] == "orion" and row["vapi_assistant_id"] is None


async def test_put_with_vapi_creates_dedicated_assistant(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    monkeypatch.setattr(voice_config, "get_settings", lambda: _settings(vapi_api_key="k"))

    async def fake_sync(workspace_id, row):
        return "dedicated-assistant-id"

    monkeypatch.setattr(voice_config, "_sync_to_vapi", fake_sync)
    async with _client() as c:
        r = await c.put(f"/api/voice-config/{ws}", json={"voice_id": "luna", "speed": 1.0})
    body = r.json()
    assert body["is_custom"] is True
    assert body["assistant_id"] == "dedicated-assistant-id"  # NOT the shared default
    assert body["assistant_id"] != DEFAULT_ASSISTANT_IDS["F"]
    assert body["vapi_synced"] is True
    assert body["sync_error"] is None


async def test_put_rejects_unknown_voice(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.put(f"/api/voice-config/{ws}", json={"voice_id": "nope"})
    assert r.status_code == 422


async def test_put_rejects_out_of_range_speed(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.put(f"/api/voice-config/{ws}", json={"voice_id": "asteria", "speed": 5.0})
    assert r.status_code == 422


async def test_by_token_public_resolves_default(db):
    ws = await make_workspace(db, industry="jewelry")
    await _voice_session(db, ws, "vctok1")
    async with _client() as c:
        r = await c.get("/api/voice-config/by-token/vctok1")
    assert r.status_code == 200
    body = r.json()
    assert body["assistant_id"] == DEFAULT_ASSISTANT_IDS["M"]
    assert body["first_message"] is None


async def test_by_token_public_resolves_dedicated(db):
    ws = await make_workspace(db, industry="jewelry")
    await _voice_session(db, ws, "vctok2")
    await db.execute(
        "insert into voice_configs (workspace_id, gender, voice_id, first_message, vapi_assistant_id, vapi_synced) "
        "values ($1, 'M', 'orion', 'Welcome in.', 'ws-assistant-9', true)",
        ws,
    )
    async with _client() as c:
        r = await c.get("/api/voice-config/by-token/vctok2")
    body = r.json()
    assert body["assistant_id"] == "ws-assistant-9"
    assert body["first_message"] == "Welcome in."
    assert body["voice_id"] == "orion"


async def test_by_token_session_pin_overrides_workspace(db):
    """Casting call #41: a per-session assistant pin in resumable_state wins over the
    workspace default, so N links on ONE tenant can each use a different assistant."""
    import json as _json

    ws = await make_workspace(db, industry="jewelry")
    # Workspace default would resolve to 'ws-assistant', but the session pins casting-B.
    await db.execute(
        "insert into voice_configs (workspace_id, gender, voice_id, vapi_assistant_id, vapi_synced) "
        "values ($1, 'F', 'asteria', 'ws-assistant', true)",
        ws,
    )
    await db.execute(
        "insert into interview_sessions (workspace_id, modality, invite_token, status, resumable_state) "
        "values ($1, 'voice', 'casttok-b', 'pending', $2)",
        ws, _json.dumps({"voice_assistant_id": "casting-B", "voice_first_message": "Hey, thanks for calling."}),
    )
    async with _client() as c:
        r = await c.get("/api/voice-config/by-token/casttok-b")
    body = r.json()
    assert body["assistant_id"] == "casting-B"          # pin wins, not the workspace default
    assert body["first_message"] == "Hey, thanks for calling."


async def test_by_token_unknown_404(db):
    async with _client() as c:
        r = await c.get("/api/voice-config/by-token/does-not-exist")
    assert r.status_code == 404


def _settings(**over):
    """Minimal settings stand-in for the fields the router reads."""
    from types import SimpleNamespace

    base = {"vapi_api_key": "", "voice_shared_secret": ""}
    base.update(over)
    return SimpleNamespace(**base)
