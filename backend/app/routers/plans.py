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
from ..pipeline import entities
from ..pipeline.compiler import _load_industry_block
from ..pipeline.handoff import _has_attribution, build_handoff_package
from ..queue import enqueue

import logging

log = logging.getLogger("nexus.plans")

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
# NO_RESPONSE cut from the live machine (A22 / DAY-AUDIT watchlist): the state had no
# writer — no scheduler ever moved SENT there and no UI offered it — so the reminder
# loop was decision debt, not behavior. Non-response stays a SIGNAL the board shows by
# age (a SENT plan visibly ages; sent time is in the transition log), not a stored state.
# The enum value stays in Postgres (dropping enum members is unsafe) and the chip still
# renders it for any hand-set legacy row; NO_RESPONSE→SENT remains as the escape hatch.
TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"NEXUS_CHECK", "AWAITING_APPROVAL"},  # custom path flips order (A6)
    "NEXUS_CHECK": {"AWAITING_APPROVAL", "DRAFT"},
    "AWAITING_APPROVAL": {"APPROVED", "DRAFT", "NEXUS_CHECK"},
    "APPROVED": {"SENT", "REVOKED"},
    "SENT": {"OPENED", "REVOKED"},
    "OPENED": {"IN_PROGRESS", "REVOKED"},
    "IN_PROGRESS": {"PAUSED", "COMPLETED"},
    "PAUSED": {"IN_PROGRESS", "COMPLETED"},
    "COMPLETED": {"COMPILED"},
    "COMPILED": set(),
    "NO_RESPONSE": {"SENT"},  # legacy escape hatch only — no path leads here anymore
    "REVOKED": set(),
}

# Session-driven lifecycle reconciliation (YC-AUDIT #7). TRANSITIONS above is the
# admin-facing machine — what a human may click. This is the system closing the loop from
# what actually happened on the respondent's side: a completed/compiled session advances
# its own plan so the plan chip can never read "Sent" beside a finished report. The session
# is the source of truth that an interview ran, so it advances the plan directly rather than
# walking the click-path (OPENED/IN_PROGRESS are display-derivable and have no writer today
# — see docs/FOR-TUNC.md). Forward-only and idempotent: never regresses a plan, never
# resurrects a REVOKED one.
_LIFECYCLE_RANK: dict[str, int] = {
    "DRAFT": 0, "NEXUS_CHECK": 1, "AWAITING_APPROVAL": 2, "APPROVED": 3,
    "NO_RESPONSE": 4, "SENT": 4, "OPENED": 5, "PAUSED": 6, "IN_PROGRESS": 6,
    "COMPLETED": 7, "COMPILED": 8,
}


async def reconcile_plan_state(conn, plan_id, to_state: str, note: str) -> str | None:
    """Advance a plan to a session-driven state (COMPLETED/COMPILED). No-ops on a
    plan-less session, a REVOKED plan, or when the plan is already at/past to_state.
    Records the move as a 'system' transition. Returns the prior state if it moved."""
    if plan_id is None:
        return None
    row = await conn.fetchrow("select state from interview_plans where id = $1", plan_id)
    if row is None:
        return None
    current = row["state"]
    if current == "REVOKED":
        return None
    if _LIFECYCLE_RANK.get(to_state, 0) <= _LIFECYCLE_RANK.get(current, -1):
        return None  # already there or further along — idempotent
    await conn.execute(
        "update interview_plans set state = $2, updated_at = now() where id = $1",
        plan_id, to_state,
    )
    await conn.execute(
        """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
           values ($1, $2, $3, 'system', $4)""",
        plan_id, current, to_state, note,
    )
    return current


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


class GenerateIn(BaseModel):
    workspace_id: str
    entity_id: str | None = None       # a known suggested-person entity (preferred)
    person_name: str | None = None     # or resolve/create by name + role
    person_role: str | None = None
    # Kaan product ask (July 7): a CUSTOM interview — admin free-text focus the generator
    # aims the mission at. Same lifecycle, same gate (NEXUS_CHECK -> human approval);
    # the focus shapes objectives, it never bypasses review or reaches the respondent raw.
    goal: str | None = None


@router.post("/generate")
async def generate(body: GenerateIn):
    """Generate an interview plan for a suggested person (A17 journey: snapshot → PLAN).

    Creates a DRAFT plan and enqueues the STANDARD generate_plan job — the API only
    enqueues; the worker runs the strong plan_generator seat. The plan then enters the
    review lifecycle at NEXUS_CHECK (A4: Nexus checks before the admin sees it), and a
    human approves before anything sends (the gate). Poll GET /api/plans/{workspace_id}
    (state flips DRAFT → NEXUS_CHECK when generation lands)."""
    pool = await get_pool()
    ws = await pool.fetchrow("select id from workspaces where id = $1", body.workspace_id)
    if ws is None:
        raise HTTPException(404, "workspace not found")

    entity_id = body.entity_id
    if entity_id is not None:
        # A provided id must actually exist in THIS workspace. Snapshot cards used to
        # carry model-transcribed ids (one corrupted digit made every Generate-plan on
        # that person 500 silently — July 8, Emre doc-2 P1 "Melis"). Ids are stitched
        # mechanically now, but heal stale/foreign ids anyway: fall back to the name.
        exists = await pool.fetchval(
            "select 1 from entities where id = $1 and workspace_id = $2",
            entity_id, body.workspace_id,
        )
        if not exists:
            log.warning("generate: entity_id %s not in workspace %s — resolving by name %r",
                        entity_id, body.workspace_id, body.person_name)
            entity_id = None
    if entity_id is None:
        if not (body.person_name and body.person_name.strip()):
            raise HTTPException(422, "entity_id or person_name is required")
        entity_id, _ = await entities.resolve_or_create(
            body.workspace_id, body.person_name, role=body.person_role
        )

    # Attach to the workspace's most recent round if one exists (nullable otherwise).
    round_id = await pool.fetchval(
        "select id from interview_rounds where workspace_id = $1 order by created_at desc limit 1",
        body.workspace_id,
    )
    plan_id = await pool.fetchval(
        "insert into interview_plans (workspace_id, round_id, interviewee_id, state) "
        "values ($1, $2, $3, 'DRAFT') returning id",
        body.workspace_id, round_id, entity_id,
    )
    payload = {"plan_id": str(plan_id), "workspace_id": body.workspace_id}
    if body.goal and body.goal.strip():
        payload["custom_goal"] = body.goal.strip()
    job_id = await enqueue("generate_plan", payload)
    return {"plan_id": str(plan_id), "state": "DRAFT", "job_id": job_id}


@router.post("/{plan_id}/redraft")
async def redraft(plan_id: str):
    """Re-run generation for a plan whose draft never landed (the credit-outage empty
    drafts) or that the Nexus check returned. Same pipeline, same gate — the redraft
    lands in NEXUS_CHECK and the check runs again. Only legal pre-approval."""
    pool = await get_pool()
    plan = await pool.fetchrow(
        "select workspace_id, state, mission from interview_plans where id = $1", plan_id
    )
    if plan is None:
        raise HTTPException(404, "plan not found")
    if plan["state"] not in ("DRAFT", "NEXUS_CHECK"):
        raise HTTPException(409, f"cannot redraft a plan in state {plan['state']}")
    mission = plan["mission"]
    mission = json.loads(mission) if isinstance(mission, str) else (mission or {})
    payload = {"plan_id": plan_id, "workspace_id": str(plan["workspace_id"])}
    if mission.get("custom_focus"):
        payload["custom_goal"] = mission["custom_focus"]  # a custom plan keeps its aim
    job_id = await enqueue("generate_plan", payload)
    return {"plan_id": plan_id, "state": plan["state"], "job_id": job_id}


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
    # Entering NEXUS_CHECK runs the REAL check (July 8 bug-hunt #2): a refined returned
    # draft goes back through the gate carrying its refinements — the only prior path
    # forward was redraft, which regenerates and DISCARDS them. Without this enqueue the
    # state would sit seeded-but-never-run (the exact P0-1 failure class).
    if to_state == "NEXUS_CHECK":
        ws = await pool.fetchval("select workspace_id from interview_plans where id = $1", plan_id)
        await enqueue("nexus_check", {"plan_id": plan_id, "workspace_id": str(ws)}, priority=90)
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

    # Conversation memory (July 8, Emre doc-2 P1): the agent must be able to reference
    # its OWN prior replies — above all the compliant alternative it just offered, so
    # "yes, add that version" works. Rebuild the recent exchange from the audited
    # change_log (last few admin turns; the log IS the transcript, no second store).
    convo_lines: list[str] = []
    for e in change_log[-6:]:
        if e.get("actor") != "admin" or "instruction" not in e:
            continue
        convo_lines.append(f"Admin: {e['instruction']}")
        if e.get("reply"):
            convo_lines.append(f"You replied: {e['reply']}")
        if e.get("alternative"):
            convo_lines.append(f"You offered this compliant rewrite: {e['alternative']}")
        if e.get("applied"):
            convo_lines.append(f"(You applied {len(e['applied'])} change(s) that turn.)")
    convo_block = (
        "# Conversation so far (oldest first — 'that version' or 'yes' refers to YOUR "
        "most recent offer below)\n" + "\n".join(convo_lines) + "\n\n"
    ) if convo_lines else ""

    user_content = (
        convo_block
        + f"# Admin instruction (respond to THIS)\n{body.instruction}\n\n"
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

    applied, rejected = [], []
    if result.get("accepted"):
        for ch in result.get("changes") or []:
            # Structural guard (non-negotiable #4, backstopped in handoff): a never_list
            # add that names who-said-what about a person is refused here, regardless of
            # what the agent proposed — the prompt-level refusal is not the enforcement.
            if (ch.get("target") == "never_list" and ch.get("op") == "add"
                    and _has_attribution(str(ch.get("value") or ""))):
                rejected.append({**ch, "reason": "attribution/sentiment: carries who-said-what "
                                 "about a person; rephrase as a neutral topic prohibition"})
                continue
            if _apply_change(mission, questions, never, ch):
                applied.append(ch)

    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "actor": "admin",
        "instruction": body.instruction,
        "accepted": bool(result.get("accepted")),
        "refusal_reason": result.get("refusal_reason"),
        # The agent's own words persist too — they ARE the conversation the next turn
        # references ("yes, add that version"). Without them the log was write-only.
        "reply": result.get("reply", ""),
        "alternative": result.get("alternative"),
        "applied": applied,
        "rejected": rejected,
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
        "rejected": rejected,
        "change_log_entry": entry,
    }
