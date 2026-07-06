"""eval-bootstrap route — the test-only hook the eval harness drives. Double-gated
(A12): refused unless EVAL_MODE is on, and it only ever mints an is_demo session."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import sessions
from app.routers.sessions import EvalBootstrapIn, eval_bootstrap


async def test_bootstrap_refused_when_eval_mode_off(db, monkeypatch):
    monkeypatch.setattr(sessions, "get_settings", lambda: SimpleNamespace(eval_mode=False))
    with pytest.raises(HTTPException) as e:
        await eval_bootstrap(EvalBootstrapIn(handoff={"goal": "x"}))
    assert e.value.status_code == 403


async def test_bootstrap_mints_is_demo_session(db, monkeypatch):
    monkeypatch.setattr(sessions, "get_settings", lambda: SimpleNamespace(eval_mode=True))
    handoff = {"goal": "map returns", "objectives": [], "never_list": ["no salaries"]}
    result = await eval_bootstrap(EvalBootstrapIn(handoff=handoff, language="en"))

    token = result["token"]
    assert token
    row = await db.fetchrow(
        """select s.status, s.language, w.is_demo, w.slug, h.package
           from interview_sessions s
           join workspaces w on w.id = s.workspace_id
           join handoff_packages h on h.plan_id = s.plan_id
           where s.invite_token = $1""",
        token,
    )
    assert row["is_demo"] is True  # A12 — never a real tenant
    assert row["slug"] == "eval-harness"
    assert row["status"] == "pending"


async def test_client_view_excludes_sensitive_columns(db):
    """QA F3: approach_note and sentiment_flag are not even columns of the view."""
    cols = {
        r["column_name"]
        for r in await db.fetch(
            "select column_name from information_schema.columns "
            "where table_name = 'client_visible_claims'"
        )
    }
    assert "approach_note" not in cols
    assert "sentiment_flag" not in cols
    assert "claim_text" in cols  # the safe fields are still there
