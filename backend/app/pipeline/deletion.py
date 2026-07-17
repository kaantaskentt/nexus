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


# ── Company (workspace) deletion — SIMPLIFY lane A (docs/SIMPLIFY-PLAN.md §6-1) ──
# The interview-delete cascade, one level up: a company delete removes the tenant and
# EVERYTHING scoped to it. This preview is the non-destructive half — it counts EXACTLY
# what the (still-gated) destructive endpoint would remove so the type-to-confirm dialog
# never understates. Deliberate departures from the interview precedent, because the
# tenant itself ceases to exist:
#   - sealed_flags are counted as REMOVED (an interview delete retains them; a company
#     delete has no tenant left to hold them). FLAGGED TO EMRE — his protocol owns the
#     final ruling; see SIMPLIFY-PLAN §6-1. The destructive path is gated until his +
#     Kaan's confirm, so counting them here commits us to nothing.
#   - agent_runs are RETAINED (internal cost/audit history, not client data); reported
#     separately as retained_agent_runs so the dialog can say what SURVIVES, honestly.


async def preview_workspace_delete(workspace_id: str) -> dict | None:
    """Exact counts of everything a company delete would remove, plus the retained
    agent-run audit count. Returns None for an unknown workspace."""
    pool = await get_pool()
    name = await pool.fetchval("select name from workspaces where id = $1", workspace_id)
    if name is None:
        return None

    async def n(sql: str) -> int:
        return int(await pool.fetchval(sql, workspace_id) or 0)

    sess = "select id from interview_sessions where workspace_id = $1"
    claims = "select id from claim_records where workspace_id = $1"
    wfs = "select id from workflows where workspace_id = $1"
    plans = "select id from interview_plans where workspace_id = $1"

    return {
        "workspace_id": str(workspace_id),
        "name": name,
        "sessions": await n("select count(*) from interview_sessions where workspace_id = $1"),
        "turns": await n(f"select count(*) from utterances where session_id in ({sess})"),
        "records": await n("select count(*) from claim_records where workspace_id = $1"),
        "conflicts": await n("select count(*) from claim_conflicts where workspace_id = $1"),
        "pain_scores": await n(f"select count(*) from pain_scores where claim_id in ({claims})"),
        "workflows": await n("select count(*) from workflows where workspace_id = $1"),
        "workflow_steps": await n(f"select count(*) from workflow_steps where workflow_id in ({wfs})"),
        "sops": await n(f"select count(*) from workflow_sops where workflow_id in ({wfs})"),
        "snapshot_cards": await n("select count(*) from snapshot_cards where workspace_id = $1"),
        "plans": await n("select count(*) from interview_plans where workspace_id = $1"),
        "plan_transitions": await n(
            f"select count(*) from plan_state_transitions where plan_id in ({plans})"),
        "entities": await n("select count(*) from entities where workspace_id = $1"),
        "scrape_sources": await n("select count(*) from scrape_sources where workspace_id = $1"),
        "heuristics": await n("select count(*) from heuristics where workspace_id = $1"),
        "promises": await n("select count(*) from artifact_promises where workspace_id = $1"),
        "opportunities": await n(
            "select count(*) from automation_opportunities where workspace_id = $1"),
        "voice_config": await n("select count(*) from voice_configs where workspace_id = $1"),
        "report_shares": await n("select count(*) from report_shares where workspace_id = $1"),
        # Departure from the interview precedent — flagged to Emre (see module note).
        "sealed_flags": await n("select count(*) from sealed_flags where workspace_id = $1"),
        # Survives the delete with its workspace/session refs nulled (audit history).
        "retained_agent_runs": await n("select count(*) from agent_runs where workspace_id = $1"),
    }


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
            # Cancel this session's not-yet-run post-call jobs (compute_yield,
            # screen_disclosures, compile fan-out). Left queued, they would run against a
            # gone session and crash-retry into dead 'failed' rows. Same transaction so the
            # delete and the cancel commit together. The render_snapshot enqueue below runs
            # AFTER this transaction, so it is deliberately not cancelled here.
            await conn.execute(
                "delete from jobs where payload->>'session_id' = $1 and status in ('queued','running')",
                session_id)
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


async def delete_workspace(workspace_id: str) -> dict | None:
    """Tear a whole tenant down in one transaction (SIMPLIFY §6-1). The FastAPI route is
    hard-gated (settings.workspace_delete_enabled, default OFF) so this never runs until
    Kaan confirms the semantics. Returns the removal summary, or None for an unknown id.

    Most workspace_id FKs have NO `on delete cascade`, so children are deleted by hand,
    children-first: claim_records reference scrape_sources + entities, sessions reference
    plans + rounds + entities, so those parents fall only after their referents. The few
    tables that DO cascade on the workspace row (voice_configs, artifact_promises,
    automation_opportunities, report_shares, user_roles) are also cleared explicitly here
    so the summary is honest and the order is one readable list rather than half-implicit.

    Deliberate, precedent-departing choices (see module note, flagged to Emre):
      - sealed_flags are DELETED (an interview delete retains them; here the tenant that
        gave them context is gone).
      - agent_runs are RETAINED with workspace_id AND session_id nulled — the internal
        cost/audit record outlives the client tenant."""
    pool = await get_pool()
    name = await pool.fetchval("select name from workspaces where id = $1", workspace_id)
    if name is None:
        return None
    ws = str(workspace_id)

    async with pool.acquire() as conn:
        async with conn.transaction():
            session_ids = [r["id"] for r in await conn.fetch(
                "select id from interview_sessions where workspace_id = $1", ws)]
            workflow_ids = [r["id"] for r in await conn.fetch(
                "select id from workflows where workspace_id = $1", ws)]
            plan_ids = [r["id"] for r in await conn.fetch(
                "select id from interview_plans where workspace_id = $1", ws)]
            claim_ids = [r["id"] for r in await conn.fetch(
                "select id from claim_records where workspace_id = $1", ws)]

            summary = {
                "sessions": len(session_ids),
                "records": len(claim_ids),
                "workflows": len(workflow_ids),
                "plans": len(plan_ids),
            }

            # Claim-derived rows + supersede links (any claim, in or out of this tenant,
            # pointing at a doomed one has its link cut before the delete).
            if claim_ids:
                await conn.execute(
                    "update claim_records set supersedes_id = null where supersedes_id = any($1::uuid[])",
                    claim_ids)
                await conn.execute(
                    "delete from pain_scores where claim_id = any($1::uuid[])", claim_ids)
            await conn.execute("delete from claim_conflicts where workspace_id = $1", ws)
            await conn.execute("delete from automation_opportunities where workspace_id = $1", ws)
            await conn.execute("delete from heuristics where workspace_id = $1", ws)

            # Workflow subtree.
            if workflow_ids:
                for table in ("workflow_sops", "workflow_step_overlays", "workflow_steps"):
                    await conn.execute(
                        f"delete from {table} where workflow_id = any($1::uuid[])", workflow_ids)
            await conn.execute("delete from workflows where workspace_id = $1", ws)

            # Cancel not-yet-run jobs referencing any doomed session OR the tenant itself —
            # the whole workspace is gone, so nothing queued against it can succeed. Same
            # transaction; payload->>'...' is text, so session ids are compared as strings.
            if session_ids:
                await conn.execute(
                    "delete from jobs where payload->>'session_id' = any($1::text[]) "
                    "and status in ('queued','running')",
                    [str(s) for s in session_ids])
            await conn.execute(
                "delete from jobs where payload->>'workspace_id' = $1 and status in ('queued','running')", ws)

            # Session subtree (before sessions themselves).
            if session_ids:
                await conn.execute("delete from utterances where session_id = any($1::uuid[])", session_ids)
                await conn.execute("delete from observer_insights where session_id = any($1::uuid[])", session_ids)
                await conn.execute("delete from roleplay_debriefs where session_id = any($1::uuid[])", session_ids)
            await conn.execute("delete from artifact_promises where workspace_id = $1", ws)

            # Safety layer + audit: sealed flags DELETED (departure, flagged to Emre);
            # agent_runs RETAINED with both refs nulled.
            await conn.execute("delete from sealed_flags where workspace_id = $1", ws)
            await conn.execute(
                "update agent_runs set workspace_id = null, session_id = null where workspace_id = $1", ws)

            # claim_records fall before the things they reference (scrape_sources, entities).
            await conn.execute("delete from claim_records where workspace_id = $1", ws)
            await conn.execute("delete from scrape_sources where workspace_id = $1", ws)
            await conn.execute("delete from report_shares where workspace_id = $1", ws)
            await conn.execute("delete from voice_configs where workspace_id = $1", ws)
            await conn.execute("delete from snapshot_cards where workspace_id = $1", ws)

            # Sessions reference plans + rounds + entities; drop sessions, then the plan
            # subtree, then rounds, then entities.
            await conn.execute("delete from interview_sessions where workspace_id = $1", ws)
            if plan_ids:
                await conn.execute("delete from handoff_packages where plan_id = any($1::uuid[])", plan_ids)
                await conn.execute("delete from plan_state_transitions where plan_id = any($1::uuid[])", plan_ids)
            await conn.execute("delete from interview_plans where workspace_id = $1", ws)
            await conn.execute("delete from interview_rounds where workspace_id = $1", ws)
            await conn.execute("delete from entities where workspace_id = $1", ws)

            # The tenant row itself — cascades user_roles + any remaining cascade children.
            await conn.execute("delete from workspaces where id = $1", ws)

    log.info("delete_workspace: %s (%s) removed — %d sessions, %d records, %d workflows",
             ws, name, len(session_ids), len(claim_ids), len(workflow_ids))
    return {"deleted": True, "name": name, "removed": summary}
