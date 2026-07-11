"""WS-4a stale-session sweeper: an abandoned 'active' interview auto-completes through
the SAME shared path as the Finish click (compile + disclosure screen + promise scan +
plan reconcile), while fresh, paused, and demo-tenant sessions are never touched."""

import json

from app.pipeline import reconcile
from tests.conftest import make_workspace


async def _session(db, ws, *, status="active", kind="interview", last_turn_min_ago=None,
                   plan_id=None):
    state = {}
    if last_turn_min_ago is not None:
        row = await db.fetchrow(
            "select (now() - ($1 || ' minutes')::interval) as t", str(last_turn_min_ago))
        state["last_turn_at"] = row["t"].isoformat()
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, plan_id, modality, status, "
        "session_kind, started_at, resumable_state) "
        "values ($1, $2, 'text', $3, $4, now() - interval '3 hours', $5) returning id",
        ws, plan_id, status, kind, json.dumps(state),
    )


async def test_sweep_completes_stale_active_and_fans_out(db):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await db.fetchval(
        "insert into interview_plans (workspace_id, state) values ($1, 'SENT') returning id", ws)
    sid = await _session(db, ws, last_turn_min_ago=90, plan_id=plan_id)
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) "
        "values ($1, 0, 'agent', 'hello')", sid)

    n = await reconcile.sweep_stale_sessions(idle_minutes=60)
    assert n == 1

    row = await db.fetchrow(
        "select status, ended_at from interview_sessions where id=$1", sid)
    assert row["status"] == "completed" and row["ended_at"] is not None
    # Same fan-out as the Finish endpoint.
    kinds = [r["kind"] for r in await db.fetch(
        "select kind from jobs where payload->>'session_id' = $1 order by id", str(sid))]
    assert kinds == ["compile_session", "screen_disclosures", "scan_artifact_promises"]
    # Plan advanced in lockstep (YC-AUDIT #7) with the sweep's own audit note.
    assert await db.fetchval(
        "select state from interview_plans where id=$1", plan_id) == "COMPLETED"
    note = await db.fetchval(
        "select note from plan_state_transitions where plan_id=$1 and to_state='COMPLETED'",
        plan_id)
    assert "sweep" in note


async def test_sweep_leaves_fresh_paused_and_demo_alone(db):
    ws = await make_workspace(db, industry="jewelry")
    fresh = await _session(db, ws, last_turn_min_ago=5)
    paused = await _session(db, ws, status="paused", last_turn_min_ago=600)
    demo_ws = await make_workspace(db, industry="jewelry", is_demo=True)
    demo = await _session(db, demo_ws, last_turn_min_ago=600)

    n = await reconcile.sweep_stale_sessions(idle_minutes=60)
    assert n == 0
    for sid, expect in ((fresh, "active"), (paused, "paused"), (demo, "active")):
        assert await db.fetchval(
            "select status from interview_sessions where id=$1", sid) == expect


async def test_sweep_context_session_compiles_with_snapshot_render(db):
    ws = await make_workspace(db, industry="jewelry")
    sid = await _session(db, ws, kind="context", last_turn_min_ago=90)
    await reconcile.sweep_stale_sessions(idle_minutes=60)
    payload = await db.fetchval(
        "select payload from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sid))
    assert payload["render_snapshot"] is True


async def test_enqueue_sweep_once_never_stacks(db):
    await reconcile.enqueue_sweep_once()
    await reconcile.enqueue_sweep_once()
    assert await db.fetchval(
        "select count(*) from jobs where kind='sweep_stale_sessions' and status='queued'") == 1
