"""Interview plans + lifecycle state machine (Phase 3).
Transitions are validated server-side; the UI only renders state."""

import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..db import get_pool
from ..llm import extract_json, run_agent
from ..pipeline.compiler import _load_industry_block
from ..pipeline.handoff import build_handoff_package
from ..queue import enqueue

router = APIRouter()

INVITE_TTL_DAYS = 14

# Refine-chat applies only these bounded, well-understood edits; anything else the
# agent proposes is logged as a proposal (audited) but never blind-applied to the plan.
# never_list overrides objectives, so adds there are always safe; the rest are additive
# plan shaping. Claim text / who-said-what / sentiment are refused by the prompt upstream.
_REFINE_TARGETS = {"never_list", "suggested_questions", "handling_notes"}

_REFINE_OUTPUT_CONTRACT = """
## Output — return ONE json object, nothing else
{
  "accepted": true | false,          // false when the request crosses a hard rule
  "refusal_reason": "plain why, if not accepted",
  "alternative": "a compliant rewrite you offer, if any",
  "reply": "what you say back to the admin (client-facing; no em-dashes)",
  "changes": [                        // the machine rules to apply (empty if refused)
    {
      "target": "never_list | suggested_questions | handling_notes",
      "op": "add | remove",
      "value": "the exact string (never_list / handling_notes) or the open-form question text",
      "before": "prior value or null",
      "after": "new value"
    }
  ]
}
Only use the three targets above. If the true edit is elsewhere, set accepted=false and
explain, or express it as a handling_note. Never put claim text, quotes, who-said-what,
or a person-judgment into any value (reformulate to open-form process language instead).
"""

# One source of truth for legal transitions (MERGE_PLAN Phase 3).
TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"NEXUS_CHECK", "AWAITING_APPROVAL"},  # custom path flips order (A6)
    "NEXUS_CHECK": {"AWAITING_APPROVAL", "DRAFT"},
    "AWAITING_APPROVAL": {"APPROVED", "DRAFT", "NEXUS_CHECK"},
    "APPROVED": {"SENT", "REVOKED"},
    "SENT": {"OPENED", "NO_RESPONSE", "REVOKED"},
    "OPENED": {"IN_PROGRESS", "NO_RESPONSE", "REVOKED"},
    "IN_PROGRESS": {"PAUSED", "COMPLETED"},
    "PAUSED": {"IN_PROGRESS", "COMPLETED"},
    "COMPLETED": {"COMPILED"},
    "COMPILED": set(),
    "NO_RESPONSE": {"SENT"},  # one gentle reminder max (A4)
    "REVOKED": set(),
}


@router.get("/{workspace_id}")
async def list_plans(workspace_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """select p.*, e.canonical_name as interviewee_name, e.role as interviewee_role,
                  p.mission->>'interview_topic' as interview_topic
           from interview_plans p
           left join entities e on e.id = p.interviewee_id
           where p.workspace_id = $1 order by p.created_at desc""",
        workspace_id,
    )
    return [dict(r) for r in rows]


@router.post("/{plan_id}/transition")
async def transition(plan_id: str, to_state: str, actor: str = "admin", note: str | None = None):
    pool = await get_pool()
    row = await pool.fetchrow("select state from interview_plans where id = $1", plan_id)
    if row is None:
        raise HTTPException(404, "plan not found")
    from_state = row["state"]
    if to_state not in TRANSITIONS.get(from_state, set()):
        raise HTTPException(409, f"illegal transition {from_state} → {to_state}")
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            "update interview_plans set state = $2, updated_at = now() where id = $1",
            plan_id,
            to_state,
        )
        await conn.execute(
            """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
               values ($1, $2, $3, $4, $5)""",
            plan_id,
            from_state,
            to_state,
            actor,
            note,
        )
    # On approval, build the interviewer's handoff package (deny-by-default: no claim
    # text, no quarantined records — enforced in handoff.build_handoff_package).
    if to_state == "APPROVED":
        await enqueue("build_handoff", {"plan_id": plan_id})
    return {"plan_id": plan_id, "from": from_state, "to": to_state}


class SendIn(BaseModel):
    interviewee_name: str | None = None  # display only; the plan already links the entity
    email: str | None = None
    job_title: str | None = None
    language: str = "en"


@router.post("/{plan_id}/send")
async def send_interview(plan_id: str, body: SendIn):
    """Send Interview (A4): mint the respondent's token-keyed session from an APPROVED
    plan, ensure the handoff package is built, and move the plan to SENT. Returns the
    invite token. Nothing reaches the interviewee here except the token — the handoff
    (never claim text, never quarantined) is what the runtime agent will load."""
    pool = await get_pool()
    plan = await pool.fetchrow(
        "select id, workspace_id, round_id, interviewee_id, state from interview_plans where id = $1",
        plan_id,
    )
    if plan is None:
        raise HTTPException(404, "plan not found")
    if plan["state"] != "APPROVED":
        raise HTTPException(409, f"plan must be APPROVED to send (is {plan['state']})")

    # Build the handoff synchronously so it exists the moment the respondent starts.
    await build_handoff_package(plan_id)

    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS)
    async with pool.acquire() as conn, conn.transaction():
        session_id = await conn.fetchval(
            """insert into interview_sessions
                 (workspace_id, plan_id, round_id, interviewee_id, modality, language,
                  invite_token, token_expires_at, status)
               values ($1,$2,$3,$4,'text',$5,$6,$7,'pending') returning id""",
            plan["workspace_id"], plan_id, plan["round_id"], plan["interviewee_id"],
            body.language, token, expires,
        )
        await conn.execute(
            "update interview_plans set state = 'SENT', updated_at = now() where id = $1", plan_id)
        await conn.execute(
            """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
               values ($1, 'APPROVED', 'SENT', 'admin', $2)""",
            plan_id, f"sent to {body.interviewee_name or 'interviewee'}")

    base = get_settings().app_base_url
    return {
        "session_id": str(session_id),
        "token": token,
        "invite_path": f"/i/{token}",
        "invite_url": f"{base}/i/{token}",
        "state": "SENT",
    }


def _apply_change(mission: dict, questions: list, never: list, change: dict) -> bool:
    """Apply one bounded refine change in place. Returns True if it touched the plan."""
    target, op, value = change.get("target"), change.get("op"), change.get("value")
    if target not in _REFINE_TARGETS or not value:
        return False
    if target == "never_list":
        if op == "add" and value not in never:
            never.append(value); return True
        if op == "remove" and value in never:
            never.remove(value); return True
    elif target == "handling_notes":
        notes = mission.setdefault("handling_notes", [])
        if op == "add" and value not in notes:
            notes.append(value); return True
        if op == "remove" and value in notes:
            notes.remove(value); return True
    elif target == "suggested_questions":
        texts = [q.get("text") for q in questions]
        if op == "add" and value not in texts:
            questions.append({"text": value, "topic": "process_step"}); return True
        if op == "remove" and value in texts:
            questions[:] = [q for q in questions if q.get("text") != value]; return True
    return False


class RefineIn(BaseModel):
    instruction: str


@router.post("/{plan_id}/refine-chat")
async def refine_chat(plan_id: str, body: RefineIn):
    """Plain-language plan edit → machine rules, applied with an audited change_log
    entry (A5). The agent refuses hard-rule violations (claim text, sentiment, leading
    questions, credential asks); we apply only the bounded, safe edits it returns and
    record everything — accepted or refused — to the plan's change_log. Never silent."""
    pool = await get_pool()
    plan = await pool.fetchrow(
        "select p.mission, p.suggested_questions, p.never_list, p.change_log, w.industry "
        "from interview_plans p join workspaces w on w.id = p.workspace_id where p.id = $1",
        plan_id,
    )
    if plan is None:
        raise HTTPException(404, "plan not found")

    def _loads(v, default):
        return json.loads(v) if isinstance(v, str) else (v if v is not None else default)

    mission = _loads(plan["mission"], {})
    questions = _loads(plan["suggested_questions"], [])
    never = _loads(plan["never_list"], [])
    change_log = _loads(plan["change_log"], [])

    user_content = (
        f"# Admin instruction\n{body.instruction}\n\n"
        f"# Current plan (edit only via the contract below)\n"
        f"mission: {json.dumps(mission, ensure_ascii=False)}\n"
        f"suggested_questions: {json.dumps(questions, ensure_ascii=False)}\n"
        f"never_list: {json.dumps(never, ensure_ascii=False)}\n"
        + _REFINE_OUTPUT_CONTRACT
    )
    raw = await run_agent(
        "plan_refine_chat", user_content, workspace_id=None,
        industry_block=_load_industry_block(plan["industry"]),
    )
    result = extract_json(raw)

    applied = []
    if result.get("accepted"):
        for ch in result.get("changes") or []:
            if _apply_change(mission, questions, never, ch):
                applied.append(ch)

    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "actor": "admin",
        "instruction": body.instruction,
        "accepted": bool(result.get("accepted")),
        "refusal_reason": result.get("refusal_reason"),
        "applied": applied,
        "proposed": result.get("changes") or [],
    }
    change_log.append(entry)

    await pool.execute(
        "update interview_plans set mission=$2, suggested_questions=$3, never_list=$4, "
        "change_log=$5, updated_at=now() where id=$1",
        plan_id, json.dumps(mission), json.dumps(questions), json.dumps(never),
        json.dumps(change_log),
    )
    return {
        "accepted": entry["accepted"],
        "reply": result.get("reply", ""),
        "alternative": result.get("alternative"),
        "applied": applied,
        "change_log_entry": entry,
    }
