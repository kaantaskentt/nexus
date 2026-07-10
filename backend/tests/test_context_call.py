"""F7 BETA context call wiring: the mint is gated on the creation-time beta flag, a
'context' session binds the context-collector persona in both engine paths while every
other kind keeps the interviewer, the by-token payload carries the BETA marker, and
compile does NOT skip the kind (the transcript feeds the same pipeline)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import compiler, interview
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _beta_workspace(c):
    r = await c.post("/api/workspaces", json={
        "name": "Beta Call Co", "industry": "printing",
        "contact_person": "Kerem", "beta_context_call": True,
    })
    assert r.status_code == 200
    return r.json()["id"]


async def test_mint_gated_on_beta_flag(db):
    plain = await make_workspace(db)
    async with _client() as c:
        off = await c.post(f"/api/workspaces/{plain}/context-call")
        assert off.status_code == 403

        ws = await _beta_workspace(c)
        minted = await c.post(f"/api/workspaces/{ws}/context-call")
        assert minted.status_code == 200
        token = minted.json()["token"]
        assert minted.json()["invite_path"] == f"/i/{token}"

        by_token = (await c.get(f"/api/sessions/by-token/{token}")).json()
    assert by_token["context_call"] is True
    assert "test_mode" not in by_token  # the client's room stays chrome-free
    # SIMPLIFY G: the founder's done page deep-links to the snapshot their call built, so
    # the payload carries the workspace slug (and only the slug — no other workspace data).
    slug = await db.fetchval("select slug from workspaces where id = $1", ws)
    assert by_token["workspace_slug"] == slug
    # snapshot_exists distinguishes first vs later call — false on a fresh workspace (no cards).
    assert by_token["snapshot_exists"] is False

    row = await db.fetchrow(
        "select s.session_kind, s.modality, e.canonical_name from interview_sessions s "
        "left join entities e on e.id = s.interviewee_id where s.invite_token = $1",
        token,
    )
    assert row["session_kind"] == "context"
    assert row["modality"] == "voice"
    assert row["canonical_name"] == "Kerem"  # the CEO entity attributes the compile


async def test_interview_by_token_omits_context_only_fields(db):
    """The context-only fields (context_call, workspace_slug, snapshot_exists) never appear
    on an employee interview payload — an employee respondent learns no workspace route and
    no snapshot state."""
    ws = await make_workspace(db)
    token = "plain-interview-token-abc"
    await db.execute(
        "insert into interview_sessions (workspace_id, invite_token) values ($1, $2)",
        ws, token,
    )
    async with _client() as c:
        payload = (await c.get(f"/api/sessions/by-token/{token}")).json()
    assert "context_call" not in payload
    assert "workspace_slug" not in payload
    assert "snapshot_exists" not in payload


async def test_turn_engine_binds_collector_for_context_kind(db, monkeypatch):
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)

    seen = {}
    async def _chat(agent_name, messages, **kw):
        seen["agent"] = agent_name
        # System is now split into a cached stable prefix (extra_system) + a volatile tail
        # (volatile_system) for prompt caching; the model sees them concatenated, so assert
        # on the combination — the split is an internal caching detail.
        seen["system"] = f"{kw.get('extra_system', '')}\n{kw.get('volatile_system', '')}"
        return "Thanks for making the time. Where does the day usually start?"
    monkeypatch.setattr("app.pipeline.interview.run_chat", _chat)

    out = await interview.run_interview_turn(str(sid), None)
    assert seen["agent"] == "context_collector"
    assert "This context call (BETA)" in seen["system"]
    assert "handoff package" not in seen["system"]
    assert out["reply"].startswith("Thanks")

    # A plain interview session keeps the interviewer + the handoff block, unchanged.
    plain_ws = await make_workspace(db)
    plain_sid = await make_session(db, plain_ws)
    await interview.run_interview_turn(str(plain_sid), None)
    assert seen["agent"] == "interviewer"
    assert "handoff package" in seen["system"]


async def test_voice_system_binds_collector_for_context_kind(db):
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)

    # build_voice_system now returns prompt-cache content blocks; the model sees their
    # text concatenated, so join before asserting.
    system = "".join(b["text"] for b in await interview.build_voice_system(str(sid)))
    assert "Context Collector" in system  # the persona's own heading
    assert "This context call (BETA)" in system

    plain_ws = await make_workspace(db)
    plain_sid = await make_session(db, plain_ws)
    plain_system = "".join(b["text"] for b in await interview.build_voice_system(str(plain_sid)))
    assert "Context Collector" not in plain_system
    assert "handoff package" in plain_system


async def test_compile_does_not_skip_context_kind(db, monkeypatch):
    """The whole point of F7: the context call feeds the SAME pipeline as an uploaded
    CEO transcript. Prove the voice_test/roleplay skip guard does not catch it."""
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)
    await db.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'respondent','Repricing eats my mornings.')",
        sid)

    class Engaged(Exception):
        pass

    async def _boom(*a, **k):
        raise Engaged()
    monkeypatch.setattr("app.pipeline.compiler.run_agent", _boom)  # compiler binds it at import
    with pytest.raises(Engaged):
        await compiler.compile_session({"session_id": str(sid)})


async def test_complete_context_call_requests_snapshot_render(db):
    """Completing a context call enqueues the compile WITH render_snapshot (the
    CEO/discovery-class auto-render) — a plain interview completion must not."""
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
        await db.execute(
            "insert into utterances (session_id,turn_index,speaker,text) "
            "select id, 0, 'respondent', 'x' from interview_sessions where invite_token = $1",
            token)
        done = await c.post(f"/api/sessions/by-token/{token}/complete")
        assert done.json()["status"] == "completed"
    payload = await db.fetchval(
        """select payload from jobs where kind = 'compile_session'
           order by id desc limit 1""")
    import json as _json
    payload = _json.loads(payload) if isinstance(payload, str) else payload
    assert payload.get("render_snapshot") is True


# ── ANYTIME-CONTEXT: additive mint + optional modality ──────────────────────────────
async def test_mint_is_additive_and_honors_modality(db):
    """The knowledge-engine loop: the mint has no once-only gate (a CEO adds context any
    time → each click is a distinct additive context session), and modality is voice by
    default (byte-identical to before) or 'text' when asked. An invalid modality is 422."""
    async with _client() as c:
        ws = await _beta_workspace(c)

        # Additive: two mints → two distinct context sessions on the SAME workspace.
        t1 = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
        t2 = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
        assert t1 != t2
        n = await db.fetchval(
            "select count(*) from interview_sessions where workspace_id=$1 and session_kind='context'", ws)
        assert n == 2

        # Default modality is voice (unchanged behavior).
        m1 = await db.fetchval("select modality from interview_sessions where invite_token=$1", t1)
        assert m1 == "voice"

        # Explicit text.
        t3 = (await c.post(f"/api/workspaces/{ws}/context-call?modality=text")).json()["token"]
        m3 = await db.fetchval("select modality from interview_sessions where invite_token=$1", t3)
        assert m3 == "text"

        # Invalid modality is rejected.
        bad = await c.post(f"/api/workspaces/{ws}/context-call?modality=carrier-pigeon")
        assert bad.status_code == 422


async def test_additive_context_call_caps_compile_at_claimed(db):
    """ANYTIME-CONTEXT (team-lead decision 1): the FIRST context call is uncapped (null →
    its tested CONFIRMED behavior, A24); an ADDITIVE call (a prior context call exists) caps
    its compile at CLAIMED — a founder's own single account, matching the ADD-4 precedent.
    The compiler reads compile_max_tag from the session row (payload.max_tag or the column)."""
    async with _client() as c:
        ws = await _beta_workspace(c)

        first = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
        first_cap = await db.fetchval(
            "select compile_max_tag from interview_sessions where invite_token=$1", first)
        assert first_cap is None  # first call uncapped — CONFIRMED behavior unchanged

        additive = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
        add_cap = await db.fetchval(
            "select compile_max_tag from interview_sessions where invite_token=$1", additive)
        assert add_cap == "CLAIMED"  # additive call capped at CLAIMED
