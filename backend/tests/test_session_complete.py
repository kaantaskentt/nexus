"""Completing a text interview marks it done and enqueues the Stage 4 compile — the
text-path equivalent of the voice end-of-call trigger (without it, a finished text
interview never becomes a report)."""

from app.routers.sessions import complete
from tests.conftest import make_workspace


async def test_complete_marks_done_and_enqueues_compile(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, invite_token, status) "
        "values ($1, 'text', 'done-tok', 'active') returning id", ws)

    result = await complete("done-tok")
    assert result["status"] == "completed"

    status = await db.fetchval("select status from interview_sessions where id=$1", sess)
    assert status == "completed"
    jobs = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1", str(sess))
    assert jobs == 1

    # Idempotent — completing again doesn't double-enqueue.
    await complete("done-tok")
    jobs2 = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1", str(sess))
    assert jobs2 == 1
