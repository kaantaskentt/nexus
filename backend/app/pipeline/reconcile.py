"""Reconcile backstop — self-heals the "records saved, snapshot never composed" class
(test-mest §2). A finished founder context call fans out to a compile job, then a
render_snapshot job. Either can fail — a transient renderer hiccup, or an API-credit
outage longer than the queue's 3-attempt/30s retry budget — and the queue then abandons
the job at 'failed' with no recovery, leaving the workspace with records but no snapshot
until a human re-queues by hand (which is exactly what watchtower had to do on July 10).

This pass makes that recovery automatic and idempotent. It covers BOTH holes to the same
symptom:

  1. a completed context/live session with utterances but NO records and NO compile job
     → enqueue compile once (an abnormally-ended call the webhook never compiled — the
     named-suspect route; belt to voice.py's braces);
  2. a workspace whose founder context call produced records but has ZERO snapshot cards
     and no render already in flight → enqueue one render_snapshot.

Every branch is an existence check, so a re-run — or a race with the live pipeline — is a
no-op. Scope guards (team-lead seam-A constraints):
  - session_kind = 'context' ONLY, so employee interviews never auto-render (A3) and the
    non-compiling kinds compiler.py skips (voice_test / roleplay, ~L188) are excluded by
    construction — a context call is always a real, compilable discovery call;
  - is_demo = false, so the sweep never re-animates a demo tenant (A12 firewall);
  - the render reads through client_visible_claims and the compile through utterances —
    never the base claim_records content — so quarantined / sealed material is never
    surfaced (non-negotiable #4); the only claim_records touch is an existence COUNT.
Every enqueue is logged (watchtower reads those). It is enqueued once at worker startup
(self-heals on every deploy) and registered as the reconcile_snapshots job kind to run on
demand; a standing timed cadence is a proposal for the log, not built here."""

import logging

from ..db import get_pool
from ..queue import enqueue, handles

log = logging.getLogger("nexus.reconcile")


async def reconcile_stuck_snapshots(workspace_id: str | None = None) -> dict:
    """Find and re-drive completed context calls stranded before their snapshot. Returns a
    small summary {compiles, renders} of what it enqueued (for logs / tests). Pass a
    workspace_id to scope to one tenant; None sweeps every tenant."""
    pool = await get_pool()

    # ── Hole 1: completed context call captured but never compiled (no records, no compile
    # job). Enqueue the compile once; render rides its fan-out (render_snapshot flag).
    stuck_compiles = await pool.fetch(
        """select s.id, s.workspace_id
             from interview_sessions s
             join workspaces w on w.id = s.workspace_id
            where s.status = 'completed'
              and s.session_kind = 'context'
              and w.is_demo = false
              and ($1::uuid is null or s.workspace_id = $1::uuid)
              and exists (select 1 from utterances u where u.session_id = s.id)
              and not exists (select 1 from claim_records c where c.session_id = s.id)
              and not exists (
                    select 1 from jobs j
                     where j.kind = 'compile_session'
                       and j.payload ->> 'session_id' = s.id::text)""",
        workspace_id,
    )
    for row in stuck_compiles:
        await enqueue(
            "compile_session",
            {"session_id": str(row["id"]), "render_snapshot": True},
        )
        log.warning(
            "reconcile: session %s completed with utterances but no compile — re-enqueued",
            row["id"],
        )

    # ── Hole 2: records exist but the snapshot never rendered (render failed past its
    # retries / died in an outage), and nothing is in flight. One render per workspace —
    # render_snapshot reads the whole client-visible record set, so a single job suffices.
    stuck_renders = await pool.fetch(
        """select distinct on (s.workspace_id) s.workspace_id, s.id as session_id, s.round_id
             from interview_sessions s
             join workspaces w on w.id = s.workspace_id
            where s.status = 'completed'
              and s.session_kind = 'context'
              and w.is_demo = false
              and ($1::uuid is null or s.workspace_id = $1::uuid)
              and exists (
                    select 1 from client_visible_claims c
                     where c.workspace_id = s.workspace_id)
              and not exists (
                    select 1 from snapshot_cards sc
                     where sc.workspace_id = s.workspace_id)
              and not exists (
                    select 1 from jobs j
                     where j.kind = 'render_snapshot'
                       and j.status in ('queued', 'running')
                       and j.payload ->> 'workspace_id' = s.workspace_id::text)
            order by s.workspace_id, s.ended_at desc nulls last""",
        workspace_id,
    )
    for row in stuck_renders:
        await enqueue(
            "render_snapshot",
            {"workspace_id": str(row["workspace_id"]),
             "round_id": str(row["round_id"]) if row["round_id"] else None,
             "session_id": str(row["session_id"])},
            priority=200,
        )
        log.warning(
            "reconcile: workspace %s has records but no snapshot — re-enqueued render",
            row["workspace_id"],
        )

    summary = {"compiles": len(stuck_compiles), "renders": len(stuck_renders)}
    if summary["compiles"] or summary["renders"]:
        log.info("reconcile: enqueued %s", summary)
    return summary


@handles("reconcile_snapshots")
async def _reconcile_snapshots_job(payload: dict) -> None:
    await reconcile_stuck_snapshots(payload.get("workspace_id"))


# ── Session completion, one shared path (WS-4a) ─────────────────────────────────────
# The respondent's Finish click and the stale-session sweeper below MUST do the same
# thing — the endpoint used to own this inline, and a session nobody clicked Finish on
# stayed 'active' forever: no compile, "In progress" on the list, report unreachable
# (Ahmet, round-2 addendum §3.4).


async def finish_session(session_id: str, session_kind: str, *, note: str) -> None:
    """Mark a session completed and fan out exactly what the Finish endpoint fans out:
    plan reconcile, compile (with snapshot render for a context call), the disclosure
    screen, and the artifact-promise scan. Idempotent at the caller (check status first)."""
    pool = await get_pool()
    plan_id = await pool.fetchval(
        "select plan_id from interview_sessions where id = $1", session_id
    )
    await pool.execute(
        "update interview_sessions set status = 'completed', ended_at = now() where id = $1",
        session_id,
    )
    # Local import: routers.plans imports pipeline modules (cycle guard, same as compiler).
    from ..routers.plans import reconcile_plan_state

    await reconcile_plan_state(pool, plan_id, "COMPLETED", note)
    compile_payload: dict = {"session_id": str(session_id)}
    if session_kind == "context":
        compile_payload["render_snapshot"] = True
    await enqueue("compile_session", compile_payload)
    # Disclosure screen runs beside the compile, never inside it — a failed compile must
    # not skip the Tier-2 sealed-flag pass (Emre stage-7 §7, A24). Same for promises.
    await enqueue("screen_disclosures", {"session_id": str(session_id)})
    await enqueue("scan_artifact_promises", {"session_id": str(session_id)})


SWEEP_IDLE_MINUTES = 60
SWEEP_INTERVAL_SECONDS = 15 * 60


async def sweep_stale_sessions(idle_minutes: int = SWEEP_IDLE_MINUTES) -> int:
    """Auto-complete real sessions abandoned mid-air: status 'active', no turn for
    idle_minutes. A respondent who reaches the interviewer's goodbye and just closes the
    tab (or drops mid-interview and never returns) must still get their transcript
    compiled and their session honestly closed — the transcript is the product, and a
    partial one is still data. 'paused' is deliberate and resumable: never touched.
    Scope guards mirror reconcile above: real kinds only, never demo tenants."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select s.id, s.session_kind
             from interview_sessions s
             join workspaces w on w.id = s.workspace_id
            where s.status = 'active'
              and s.session_kind in ('interview', 'context')
              and w.is_demo = false
              and coalesce(
                    (s.resumable_state ->> 'last_turn_at')::timestamptz,
                    s.started_at
                  ) < now() - ($1 || ' minutes')::interval""",
        str(int(idle_minutes)),
    )
    for row in rows:
        log.warning("sweep: session %s idle past %d min — completing + compiling",
                    row["id"], idle_minutes)
        await finish_session(str(row["id"]), row["session_kind"],
                             note="auto-completed by stale-session sweep")
    return len(rows)


async def enqueue_sweep_once(delay_seconds: int = 0) -> None:
    """Schedule the next sweep iff none is already queued — worker boots and the job's
    own re-scheduling would otherwise stack parallel sweep chains."""
    pool = await get_pool()
    exists = await pool.fetchval(
        "select 1 from jobs where kind = 'sweep_stale_sessions' and status = 'queued'"
    )
    if not exists:
        await enqueue("sweep_stale_sessions", {}, priority=150, delay_seconds=delay_seconds)


@handles("sweep_stale_sessions")
async def _sweep_stale_sessions_job(payload: dict) -> None:
    try:
        await sweep_stale_sessions(payload.get("idle_minutes", SWEEP_IDLE_MINUTES))
    finally:
        # Self-rescheduling heartbeat: the next sweep queues even when this one failed.
        await enqueue_sweep_once(delay_seconds=SWEEP_INTERVAL_SECONDS)
