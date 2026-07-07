"""Completing a text interview marks it done and enqueues the Stage 4 compile — the
text-path equivalent of the voice end-of-call trigger (without it, a finished text
interview never becomes a report)."""

from app.routers.plans import reconcile_plan_state
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


# ── Plan lifecycle reconciliation (YC-AUDIT #7) ──────────────────────────────
# A completed interview must advance its plan so the plan chip can never read "Sent"
# beside a finished report. The session drives the plan directly (the click-path
# OPENED/IN_PROGRESS states have no writer); COMPILED then lands from the compile job.


async def _make_plan(db, ws, state):
    return await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1, $2) returning id",
        ws, state)


async def test_complete_advances_sent_plan_to_completed(db):
    ws = await make_workspace(db, industry="jewelry")
    plan = await _make_plan(db, ws, "SENT")
    await db.execute(
        "insert into interview_sessions (workspace_id, plan_id, modality, invite_token, status) "
        "values ($1, $2, 'text', 'plan-tok', 'active')", ws, plan)

    await complete("plan-tok")

    # The plan jumped straight from SENT to COMPLETED (session is the source of truth),
    # and the move is logged as a system transition.
    state = await db.fetchval("select state from interview_plans where id=$1", plan)
    assert state == "COMPLETED"
    logged = await db.fetchval(
        "select count(*) from plan_state_transitions "
        "where plan_id=$1 and from_state='SENT' and to_state='COMPLETED' and actor='system'",
        plan)
    assert logged == 1


async def test_reconcile_is_forward_only_and_idempotent(db):
    ws = await make_workspace(db, industry="jewelry")

    # Already-COMPILED plan never regresses to COMPLETED.
    compiled = await _make_plan(db, ws, "COMPILED")
    assert await reconcile_plan_state(db, compiled, "COMPLETED", "x") is None
    assert await db.fetchval("select state from interview_plans where id=$1", compiled) == "COMPILED"

    # COMPLETED → COMPILED advances once, then no-ops.
    done = await _make_plan(db, ws, "COMPLETED")
    assert await reconcile_plan_state(db, done, "COMPILED", "compiled") == "COMPLETED"
    assert await reconcile_plan_state(db, done, "COMPILED", "compiled") is None

    # A REVOKED plan is never resurrected by a late session tail.
    revoked = await _make_plan(db, ws, "REVOKED")
    assert await reconcile_plan_state(db, revoked, "COMPLETED", "x") is None
    assert await db.fetchval("select state from interview_plans where id=$1", revoked) == "REVOKED"

    # A plan-less (discovery) session is a safe no-op.
    assert await reconcile_plan_state(db, None, "COMPLETED", "x") is None
