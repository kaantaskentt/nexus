"""Reconcile backstop (test-mest §2) — re-drives context calls stranded before their
snapshot. Both holes to 'records saved, no snapshot' become auto-recoverable, idempotently."""

from app.pipeline.reconcile import reconcile_stuck_snapshots
from tests.conftest import make_workspace


async def _context_session(db, ws, *, status="completed", round_id=None):
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind, round_id) "
        "values ($1,'voice',$2,'context',$3) returning id",
        ws, status, round_id,
    )


async def _utterance(db, sess):
    await db.execute(
        "insert into utterances (session_id, turn_index, speaker, text) "
        "values ($1, 0, 'respondent', 'we ship every morning')", sess)


async def _record(db, ws, sess=None):
    await db.execute(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text, quarantined) "
        "values ($1,$2,'statement','process_step','CLAIMED','Ships each morning', false)", ws, sess)


async def _jobs(db, kind, ws):
    return await db.fetchval(
        "select count(*) from jobs where kind=$1 and payload->>'workspace_id'=$2", kind, str(ws))


async def test_reconcile_reenqueues_render_when_records_but_no_snapshot(db):
    """Hole 2 (the test-mest case): records compiled, snapshot never rendered → one render."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws)
    await _record(db, ws, sess)                                   # records exist
    # No snapshot_cards, no render job.
    out = await reconcile_stuck_snapshots(str(ws))
    assert out == {"compiles": 0, "renders": 1}
    assert await _jobs(db, "render_snapshot", ws) == 1

    # Idempotent: the render is now in flight (queued), so a second pass does nothing.
    out2 = await reconcile_stuck_snapshots(str(ws))
    assert out2 == {"compiles": 0, "renders": 0}
    assert await _jobs(db, "render_snapshot", ws) == 1


async def test_reconcile_skips_when_snapshot_exists(db):
    """A workspace that already has cards is healthy — never re-rendered."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws)
    await _record(db, ws, sess)
    await db.execute(
        "insert into snapshot_cards (workspace_id, card_type, content, render_batch) "
        "values ($1,'learned','{}'::jsonb,1)", ws)
    out = await reconcile_stuck_snapshots(str(ws))
    assert out == {"compiles": 0, "renders": 0}


async def test_reconcile_reenqueues_compile_when_captured_but_not_compiled(db):
    """Hole 1: a completed context call with utterances but no records and no compile job
    (the abnormal-hangup route) → compile enqueued once, with the snapshot render flag."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws)
    await _utterance(db, sess)                                    # captured, never compiled
    out = await reconcile_stuck_snapshots(str(ws))
    assert out["compiles"] == 1
    job = await db.fetchrow(
        "select payload from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess))
    import json
    payload = job["payload"]
    payload = json.loads(payload) if isinstance(payload, str) else payload
    assert payload.get("render_snapshot") is True

    # Idempotent: the compile job now exists, so a re-run does not double it.
    await reconcile_stuck_snapshots(str(ws))
    n = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess))
    assert n == 1


async def test_reconcile_ignores_employee_interview_workspace(db):
    """A28/A3: a workspace whose only session is an employee interview is never auto-rendered
    or auto-compiled by the backstop — the trigger is a context (discovery) call."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind) "
        "values ($1,'text','completed','interview') returning id", ws)
    await _record(db, ws, sess)                                   # records, but not a context call
    out = await reconcile_stuck_snapshots(str(ws))
    assert out == {"compiles": 0, "renders": 0}
