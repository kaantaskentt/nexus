"""Interview turn engine — verbatim storage both directions, resumable state, and
the model never receiving claim text (the persona + handoff carry the whole world).
The model is mocked so these assert the engine's persistence, not the LLM."""

import json

import pytest

from app.pipeline import interview
from tests.conftest import make_session, make_workspace


def _mock_chat(reply: str):
    async def _run(agent_name, messages, **kwargs):
        # The conversation must start with a user turn (Anthropic requirement).
        assert messages[0]["role"] == "user"
        _mock_chat.last_messages = messages
        return reply

    return _run


async def test_opening_turn_agent_speaks_first(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    monkeypatch.setattr(interview, "run_chat", _mock_chat("Hi, I'm Nexus. Thanks for making the time."))

    result = await interview.run_interview_turn(str(sess), None)

    assert result["turn_index"] == 0
    utterances = await db.fetch("select speaker, text from utterances where session_id=$1 order by turn_index", sess)
    assert len(utterances) == 1
    assert utterances[0]["speaker"] == "agent"
    status = await db.fetchval("select status from interview_sessions where id=$1", sess)
    assert status == "active"


async def test_turn_stores_both_directions_verbatim(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    monkeypatch.setattr(interview, "run_chat", _mock_chat("opening"))
    await interview.run_interview_turn(str(sess), None)

    # A respondent reply with hedges/fillers must be stored exactly.
    verbatim = "Umm, honestly? sanırım maybe two hours, I dunno."
    monkeypatch.setattr(interview, "run_chat", _mock_chat("And then what happens?"))
    result = await interview.run_interview_turn(str(sess), verbatim)

    rows = await db.fetch("select speaker, text from utterances where session_id=$1 order by turn_index", sess)
    assert [r["speaker"] for r in rows] == ["agent", "respondent", "agent"]
    assert rows[1]["text"] == verbatim  # not cleaned up
    assert result["reply"] == "And then what happens?"

    state = await db.fetchval("select resumable_state from interview_sessions where id=$1", sess)
    state = json.loads(state) if isinstance(state, str) else state
    assert state["turn_count"] == 2


async def test_completed_session_rejects_turn(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    await db.execute("update interview_sessions set status='completed' where id=$1", sess)
    monkeypatch.setattr(interview, "run_chat", _mock_chat("x"))
    with pytest.raises(RuntimeError, match="completed"):
        await interview.run_interview_turn(str(sess), "hello")
