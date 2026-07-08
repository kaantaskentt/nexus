"""'Hear it live' voice test sessions (premium audit P1-3): admin-minted, and firewalled
by KIND at the pipeline choke points — never compiled, never disclosure-screened."""

import pytest

from app.pipeline import compiler, disclosure
from tests.conftest import make_workspace


async def test_route_mints_voice_test_session(db):
    from app.routers.voice_config import create_test_session
    ws = await make_workspace(db)
    out = await create_test_session(str(ws))
    assert out["invite_path"].startswith("/i/")
    kind = await db.fetchval(
        "select session_kind from interview_sessions where invite_token = $1", out["token"])
    assert kind == "voice_test"


async def test_compile_and_screen_skip_voice_tests(db, monkeypatch):
    ws = await make_workspace(db)
    sess = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind) "
        "values ($1,'voice','completed','voice_test') returning id", ws)
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) "
        "values ($1,0,'respondent','testing one two')", sess)

    async def _boom(*_a, **_k):
        raise AssertionError("no agent may run for a voice_test session")

    monkeypatch.setattr(compiler, "run_agent", _boom)
    monkeypatch.setattr(disclosure, "run_agent", _boom)
    await compiler.compile_session({"session_id": str(sess)})
    await disclosure.screen_session({"session_id": str(sess)})
    assert await db.fetchval("select count(*) from claim_records where session_id=$1", sess) == 0
    assert await db.fetchval("select count(*) from sealed_flags where session_id=$1", sess) == 0
