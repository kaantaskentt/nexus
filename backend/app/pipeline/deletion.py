"""Interview deletion (Kaan P2, July 9) — full cascade, honestly announced.

THE CASCADE DECISION (Kaan's open question "if you delete, does it also go from the
KB?"): YES. A claim record whose source transcript is gone is an orphan nobody can
audit — the ontology is evidence-anchored ("truth emerges from comparing records", and
a record's evidence link IS the audit trail), so the records, their pain scores, the
conflicts they sit in, the workflow mapped from the session, and the automation
opportunities citing any of it all go together. The preview endpoint counts EXACTLY
what will be removed so the warning dialog never understates (no silent partial
deletes — the watchtower rule).

Deliberate survivals:
- sealed_flags rows are RETAINED with session_id nulled. They are the Tier-2 safety
  layer, live outside the record store, and are never client-visible; an admin deleting
  an interview must not scrub a serious-disclosure record. (Flagged to Emre — his
  protocol owns the final ruling.)
- agent_runs audit rows are RETAINED with session_id nulled (cost/audit history).
- entities are never deleted (they may be referenced across sessions; an orphaned
  person entity is harmless and re-resolvable).
- The plan (if any) is set REVOKED with an audit transition, not deleted: the approved
  questions were the admin's artifact and the state machine's history stays honest.

After the cascade, if the workspace has snapshot cards, a render_snapshot job is
enqueued so no card keeps citing evidence that no longer exists.
"""

import json
import logging

from ..db import get_pool
from ..queue import enqueue

log = logging.getLogger("nexus.deletion")

DELETABLE_KINDS = ("interview",)  # v1 scope: what the Interviews list shows


async def _session_or_none(pool, session_id: str):
    return await pool.fetchrow(
        "select id, workspace_id, plan_id, session_kind, status from interview_sessions where id = $1",
        session_id,
    )


async def preview_interview_delete(session_id: str) -> dict | None:
    """Exact counts of everything the cascade will remove — feeds the warning dialog.
    Returns None for an unknown session; {'deletable': False} for a non-interview kind."""
    pool = await get_pool()
    session = await _session_or_none(pool, session_id)
    if session is None:
        return None
    if session["session_kind"] not in DELETABLE_KINDS:
        return {"deletable": False, "reason": "only interviews can be deleted"}

    ws = str(session["workspace_id"])
    claim_ids = [r["id"] for r in await pool.fetch(
        "select id from claim_records where session_id = $1", session_id)]
    conflicts = await pool.fetchval(
        "select count(*) from claim_conflicts where claim_a_id = any($1::uuid[]) or claim_b_id = any($1::uuid[])",
        claim_ids) if claim_ids else 0
    workflow_ids = [r["id"] for r in await pool.fetch(
        "select id from workflows where session_id = $1", session_id)]
    opportunities = await _opportunities_touching(pool, ws, claim_ids, workflow_ids)
    turns = await pool.fetchval(
        "select count(*) from utterances where session_id = $1", session_id)
    promises = await pool.fetchval(
        "select count(*) from artifact_promises where session_id = $1", session_id)
    has_snapshot = bool(await pool.fetchval(
        "select 1 from snapshot_cards where workspace_id = $1 limit 1", ws))

    return {
        "deletable": True,
        "turns": turns,
        "records": len(claim_ids),
        "conflicts": conflicts,
        "workflows": len(workflow_ids),
        "opportunities": len(opportunities),
        "promises": promises,
        "will_rerender_snapshot": has_snapshot,
        "has_plan": session["plan_id"] is not None,
    }


async def _opportunities_touching(pool, workspace_id, claim_ids, workflow_ids) -> list:
    """Automation opportunities resting on any deleted claim or the deleted workflow.
    An opportunity partly cited by removed evidence loses its citation basis — the
    zero-citation drop rule (structural) says it goes rather than overstating."""
    rows = await pool.fetch(
        "select id, claim_ids, workflow_id from automation_opportunities where workspace_id = $1",
        workspace_id,
    )
    deleted_claims = {str(c) for c in claim_ids}
    deleted_wfs = {str(w) for w in workflow_ids}
    hit = []
    for r in rows:
        cids = r["claim_ids"]
        cids = json.loads(cids) if isinstance(cids, str) else (cids or [])
        if (r["workflow_id"] and str(r["workflow_id"]) in deleted_wfs) or any(
            str(c) in deleted_claims for c in cids
        ):
            hit.append(r["id"])
    return hit


async def delete_interview(session_id: str) -> dict | None:
    """Execute the cascade in one transaction. Returns the removal summary, None for
    an unknown session, {'deletable': False} for a non-interview kind."""
    pool = await get_pool()
    session = await _session_or_none(pool, session_id)
    if session is None:
        return None
    if session["session_kind"] not in DELETABLE_KINDS:
        return {"deletable": False, "reason": "only interviews can be deleted"}
    ws = str(session["workspace_id"])

    async with pool.acquire() as conn:
        async with conn.transaction():
            claim_ids = [r["id"] for r in await conn.fetch(
                "select id from claim_records where session_id = $1", session_id)]
            workflow_ids = [r["id"] for r in await conn.fetch(
                "select id from workflows where session_id = $1", session_id)]
            opp_ids = await _opportunities_touching(conn, ws, claim_ids, workflow_ids)

            conflicts = 0
            if claim_ids:
                # Supersede chains: a surviving claim that superseded (or was superseded
                # by) a deleted one keeps standing on its own; the link is honestly cut.
                await conn.execute(
                    "update claim_records set supersedes_id = null where supersedes_id = any($1::uuid[])",
                    claim_ids)
                await conn.execute(
                    "delete from pain_scores where claim_id = any($1::uuid[])", claim_ids)
                conflicts = int((await conn.execute(
                    "delete from claim_conflicts where claim_a_id = any($1::uuid[]) or claim_b_id = any($1::uuid[])",
                    claim_ids)).split()[-1])
            if opp_ids:
                await conn.execute(
                    "delete from automation_opportunities where id = any($1::uuid[])", opp_ids)
            if workflow_ids:
                for table in ("workflow_sops", "workflow_step_overlays", "workflow_steps"):
                    await conn.execute(
                        f"delete from {table} where workflow_id = any($1::uuid[])", workflow_ids)
                await conn.execute(
                    "delete from workflows where id = any($1::uuid[])", workflow_ids)
            await conn.execute("delete from claim_records where session_id = $1", session_id)
            await conn.execute("delete from observer_insights where session_id = $1", session_id)
            # Safety layer survives (see module docstring); audit rows survive.
            await conn.execute(
                "update sealed_flags set session_id = null where session_id = $1", session_id)
            await conn.execute(
                "update agent_runs set session_id = null where session_id = $1", session_id)
            await conn.execute("delete from utterances where session_id = $1", session_id)
            # artifact_promises + roleplay_debriefs cascade via FK on the session delete.

            plan_revoked = False
            if session["plan_id"] is not None:
                prior = await conn.fetchval(
                    "select state from interview_plans where id = $1", session["plan_id"])
                if prior and prior != "REVOKED":
                    # Deliberately outside the click-path TRANSITIONS map: deletion is an
                    # administrative act; the audit transition keeps the history honest.
                    await conn.execute(
                        "update interview_plans set state = 'REVOKED', updated_at = now() where id = $1",
                        session["plan_id"])
                    await conn.execute(
                        """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
                           values ($1, $2, 'REVOKED', 'admin', 'interview deleted by admin')""",
                        session["plan_id"], prior)
                    plan_revoked = True

            await conn.execute("delete from interview_sessions where id = $1", session_id)

    rerender = bool(await pool.fetchval(
        "select 1 from snapshot_cards where workspace_id = $1 limit 1", ws))
    if rerender:
        # No card may keep citing evidence that no longer exists (no silent partials).
        await enqueue("render_snapshot", {"workspace_id": ws})

    log.info("delete_interview: %s removed (%d records, %d workflows) from workspace %s",
             session_id, len(claim_ids), len(workflow_ids), ws)
    return {
        "deletable": True,
        "deleted": {
            "records": len(claim_ids),
            "conflicts": conflicts,
            "workflows": len(workflow_ids),
            "opportunities": len(opp_ids),
        },
        "plan_revoked": plan_revoked,
        "snapshot_rerender_queued": rerender,
    }
