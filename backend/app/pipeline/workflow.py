"""build_workflow_schema (Phase 6) — assemble a workflow (ordered steps with
tool/action/input/output + Verified/Partial badges + spine-slot metadata) from a
compiled session's records. The report/SOP generator renders this structure; here we
just build it. Spine slots ride on each step so a future skill compiler can consume
the store without redesign — A10: this measures understanding, never promises automation.

Every step traces to claim record ids; nothing enters that isn't in the store."""

import json
import logging
import re

from ..db import get_pool
from ..llm import extract_json, run_agent
from ..queue import handles

log = logging.getLogger("nexus.workflow")
_UUID = re.compile(r"^[0-9a-f-]{36}$", re.I)

_SCHEMA = (
    'Return ONE json object: {"name":"short workflow name",'
    '"steps":[{"action":"what happens","tool":"tool or null","input":"or null",'
    '"output":"or null","verified":"verified|partial|unverified",'
    '"spine_slots":{"task":"","trigger":"","rules":"","exceptions":"","success":"","examples":""},'
    '"slot_scores":{"task":0,"trigger":0,"steps":0,"rules":0,"exceptions":0,"tools":0,"output":0,"success":0,"examples":0},'
    '"claim_ids":["id",...]}]}. '
    "Steps in real execution order. verified=corroborated across sources; partial=single-source "
    "or incomplete. slot scores 0=empty 1=partial 2=clear. Every step cites the claim ids it came from."
)


async def build_workflow_schema(payload: dict) -> None:
    session_id = payload["session_id"]
    pool = await get_pool()
    session = await pool.fetchrow(
        "select workspace_id from interview_sessions where id = $1", session_id
    )
    if session is None:
        raise RuntimeError(f"build_workflow_schema: no session {session_id}")
    workspace_id = str(session["workspace_id"])

    rows = await pool.fetch(
        """select id, kind, topic, tag, claim_text from client_visible_claims
           where session_id = $1
             and topic in ('process_step','tool','time_or_cost','success_criteria','company_fact')
           order by created_at""",
        session_id,
    )
    if not rows:
        return
    valid_ids = {str(r["id"]) for r in rows}
    lines = "\n".join(f"{r['id']} · {r['topic']}/{r['tag']} · {r['claim_text']}" for r in rows)

    try:
        schema = extract_json(await run_agent(
            "report_sop_generator",
            f"Records for this session:\n{lines}\n\n{_SCHEMA}",
            workspace_id=workspace_id, session_id=session_id,
        ))
    except ValueError as e:
        log.warning("workflow build failed for %s: %s", session_id, e)
        return

    steps = schema.get("steps") or []
    if not steps:
        return
    workflow_id = await pool.fetchval(
        "insert into workflows (workspace_id, session_id, name) values ($1,$2,$3) returning id",
        workspace_id, session_id, schema.get("name") or "Workflow",
    )
    for i, s in enumerate(steps):
        claim_ids = [c for c in (s.get("claim_ids") or []) if c in valid_ids and _UUID.match(c)]
        await pool.execute(
            """insert into workflow_steps
                 (workflow_id, step_index, tool, action, input, output, verified,
                  spine_slots, slot_scores, claim_ids)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
            workflow_id, i, s.get("tool"), s.get("action") or "", s.get("input"), s.get("output"),
            s.get("verified") if s.get("verified") in ("verified", "partial", "unverified") else "unverified",
            json.dumps(s.get("spine_slots") or {}), json.dumps(s.get("slot_scores") or {}),
            claim_ids,
        )


@handles("build_workflow_schema")
async def _build_workflow_schema_job(payload: dict) -> None:
    await build_workflow_schema(payload)
