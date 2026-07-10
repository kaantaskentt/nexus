"""Workspace picker + tenant creation (A17 — multi-company admin flow)."""

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_admin, resolve_seat
from ..config import get_settings
from ..db import get_pool
from ..pipeline import deletion, entities
from ..pipeline.transcript import parse_transcript
from ..queue import enqueue

router = APIRouter()

# Fan-out jobs a discovery compile spawns, in the order the UI reveals them. Used by the
# status endpoint to turn the raw jobs table into an honest, staged progress board.
_DISCOVERY_STAGES = [
    "compile_session",
    "build_workflow_schema",
    "score_interview_quality",
    "rate_pain",
    "score_heuristics",
    "detect_conflicts",
    "render_snapshot",
]


def _loads(v):
    return json.loads(v) if isinstance(v, str) else v


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "company"


async def _unique_slug(pool, base: str) -> str:
    """Pick a slug not already taken — base, then base-2, base-3, ..."""
    slug = base
    n = 1
    while await pool.fetchval("select 1 from workspaces where slug = $1", slug):
        n += 1
        slug = f"{base}-{n}"
    return slug


class NewWorkspaceIn(BaseModel):
    name: str
    industry: str | None = None
    website: str | None = None
    contact_person: str | None = None
    # F7 BETA: opt this workspace into "Conduct the context call with Nexus" at creation.
    beta_context_call: bool = False


@router.post("")
async def create_workspace(body: NewWorkspaceIn):
    """Create a REAL tenant (A17 Stage 0). A12 firewall: is_demo=false and the tenant
    starts with ZERO records — nothing from the demo storyline exists here. The industry
    is stored on the column so it feeds the A14 runtime calibration block at compile time;
    website + contact live in config for the snapshot header and the optional Stage-1 scrape."""
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "company name is required")
    pool = await get_pool()
    slug = await _unique_slug(pool, _slugify(name))
    config = {
        "contact_person": body.contact_person or None,
        "website": body.website or None,
        "source": "Manual entry",
    }
    if body.beta_context_call:
        config["beta_context_call"] = True
    row = await pool.fetchrow(
        "insert into workspaces (name, slug, industry, is_demo, is_internal, config) "
        "values ($1, $2, $3, false, false, $4) "
        "returning id, name, slug, industry, is_demo, config",
        name, slug, (body.industry or None), json.dumps(config),
    )
    return {**dict(row), "config": _loads(row["config"])}


@router.get("")
async def list_workspaces(user_id: str = Depends(require_admin)):
    pool = await get_pool()
    # F6 (dormant): a client seat sees ONLY its own workspace in the picker. Admins
    # (everyone while CLIENT_SEATS is off) keep today's full list, same query.
    seat = await resolve_seat(user_id)
    # Internal scaffolding (eval/e2e/voice tenants, demo-respondent dup) is hidden by
    # default — it must never render as a real client workspace in the picker (#22).
    if seat["role"] == "client":
        rows = await pool.fetch(
            "select id, name, slug, industry, is_demo, config from workspaces "
            "where is_internal = false and id = $1", seat["workspace_id"]
        )
    else:
        # Order semantics live HERE, in one place (the frontend used to `.reverse()`):
        # rows the admin dragged carry a sort_order and lead in that order; everything
        # untouched (sort_order null) falls to newest-first, so a picker nobody has
        # reordered looks exactly as it did before this column existed.
        rows = await pool.fetch(
            "select id, name, slug, industry, is_demo, config from workspaces "
            "where is_internal = false "
            "order by sort_order asc nulls last, created_at desc"
        )
    return [{**dict(r), "config": _loads(r["config"])} for r in rows]


class ReorderIn(BaseModel):
    ordered_ids: list[str]


@router.patch("/reorder", dependencies=[Depends(require_admin)])
async def reorder_workspaces(body: ReorderIn):
    """Persist a drag-reordered picker (SIMPLIFY §4-A). Writes sort_order = position for
    each id the admin arranged; ids not listed keep their null sort_order and stay in the
    newest-first tail. One transaction so a half-written order can never render. The
    is_internal picker filter is unaffected — internal tenants never reach this list, so
    an id that isn't a real client workspace is simply ignored."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for position, ws_id in enumerate(body.ordered_ids):
                await conn.execute(
                    "update workspaces set sort_order = $2 where id = $1 and is_internal = false",
                    ws_id, position,
                )
    return {"reordered": len(body.ordered_ids)}


# ── Company delete — SIMPLIFY lane A (docs/SIMPLIFY-PLAN.md §4-A/§6-1) ──────────
# Two-step by design, mirroring the interview delete: this preview feeds the
# type-company-name-to-confirm dialog with EXACT cascade counts (the dialog is the
# feature). The DESTRUCTIVE endpoint is gated separately and stays off until Kaan's
# confirm is relayed — so this read-only preview commits us to nothing.


@router.get("/{workspace_id}/delete-preview", dependencies=[Depends(require_admin)])
async def delete_preview(workspace_id: str):
    out = await deletion.preview_workspace_delete(workspace_id)
    if out is None:
        raise HTTPException(404, "workspace not found")
    return out


@router.delete("/{workspace_id}", dependencies=[Depends(require_admin)])
async def delete_workspace(workspace_id: str):
    """Destructive tenant teardown (SIMPLIFY §6-1). HARD-GATED: returns 403 until
    settings.workspace_delete_enabled is flipped on, which waits on Kaan's confirm of the
    cascade semantics (sealed-flag ruling flagged to Emre). Built, tested, and inert until
    then — the preview endpoint and dialog are what ship live."""
    if not get_settings().workspace_delete_enabled:
        raise HTTPException(403, "company delete is not enabled")
    out = await deletion.delete_workspace(workspace_id)
    if out is None:
        raise HTTPException(404, "workspace not found")
    return out


@router.get("/{workspace_id}/snapshot")
async def get_snapshot(workspace_id: str):
    """Company Snapshot cards (A3). Returns the latest render batch — append-only, so
    later rounds add batches; the UI shows the most recent. Quarantined content can't
    appear: the renderer reads only client_visible_claims."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, card_type, confidence, render_batch, content from snapshot_cards
           where workspace_id = $1
             and render_batch = (select max(render_batch) from snapshot_cards where workspace_id = $1)
           order by card_type, id""",
        workspace_id,
    )
    return [{"id": str(r["id"]), "card_type": r["card_type"], "confidence": r["confidence"],
             "render_batch": r["render_batch"], "content": _loads(r["content"])} for r in rows]


@router.get("/{workspace_id}/insights")
async def get_insights(workspace_id: str):
    """Cross-interview intelligence for the Insights surface: the conflict points and
    perception gaps the pipeline detected across sessions (A3 golden data), the banded
    pains that are the product's core finding, and the admissions worth chasing (stated
    unknowns that seed the next round). Every side reads through client_visible_claims,
    so quarantined sentiment can never surface here; a conflict is only shown when BOTH
    sides survive that view."""
    pool = await get_pool()

    conflict_rows = await pool.fetch(
        """select k.id, k.kind, k.status, k.resolution,
                  a.claim_text as a_text, a.tag as a_tag, a.session_id as a_session,
                  sa.canonical_name as a_speaker, sa.role as a_role,
                  b.claim_text as b_text, b.tag as b_tag, b.session_id as b_session,
                  sb.canonical_name as b_speaker, sb.role as b_role
           from claim_conflicts k
           join client_visible_claims a on a.id = k.claim_a_id
           join client_visible_claims b on b.id = k.claim_b_id
           left join entities sa on sa.id = a.speaker_id
           left join entities sb on sb.id = b.speaker_id
           where k.workspace_id = $1
           order by case k.kind when 'ceo_vs_floor' then 0
                                when 'worker_vs_worker' then 1 else 2 end, k.created_at""",
        workspace_id,
    )

    def _side(text, tag, speaker, role, session):
        return {"text": text, "tag": tag, "speaker": speaker, "role": role,
                "session_id": str(session) if session else None}

    conflicts = []
    for r in conflict_rows:
        res = _loads(r["resolution"])
        note = (res.get("gap") or res.get("note")) if isinstance(res, dict) else None
        conflicts.append({
            "id": str(r["id"]), "kind": r["kind"], "status": r["status"], "note": note,
            "a": _side(r["a_text"], r["a_tag"], r["a_speaker"], r["a_role"], r["a_session"]),
            "b": _side(r["b_text"], r["b_tag"], r["b_speaker"], r["b_role"], r["b_session"]),
        })

    # Key findings — the banded pains, severe first (the pain the product exists to find).
    pain_rows = await pool.fetch(
        """select c.id, c.claim_text, c.tag, c.evidence_quote, c.mention_count,
                  p.band, sp.canonical_name as speaker, sp.role as role, c.session_id
           from client_visible_claims c
           left join pain_scores p on p.claim_id = c.id
           left join entities sp on sp.id = c.speaker_id
           where c.workspace_id = $1 and c.topic = 'pain'
           order by array_position(array['severe','high','moderate','low']::text[], p.band),
                    c.mention_count desc
           limit 8""",
        workspace_id,
    )
    key_findings = [
        {"id": str(r["id"]), "text": r["claim_text"], "band": r["band"], "tag": r["tag"],
         "mention_count": r["mention_count"], "evidence_quote": r["evidence_quote"],
         "speaker": r["speaker"], "role": r["role"],
         "session_id": str(r["session_id"]) if r["session_id"] else None}
        for r in pain_rows
    ]

    # Admissions worth chasing — stated unknowns; their INTERVIEW-OBJECTIVE trigger (when
    # present) is the concrete follow-up the next round should book.
    adm_rows = await pool.fetch(
        """select c.id, c.claim_text, c.evidence_quote, c.provenance,
                  sp.canonical_name as speaker, sp.role as role, c.session_id
           from client_visible_claims c
           left join entities sp on sp.id = c.speaker_id
           where c.workspace_id = $1 and c.kind = 'admission'
           order by c.created_at
           limit 12""",
        workspace_id,
    )
    admissions = []
    for r in adm_rows:
        prov = _loads(r["provenance"]) or {}
        objectives = [t.split(":", 1)[1].strip() for t in prov.get("triggers", [])
                      if isinstance(t, str) and t.startswith("INTERVIEW-OBJECTIVE:")]
        admissions.append({
            "id": str(r["id"]), "text": r["claim_text"], "evidence_quote": r["evidence_quote"],
            "speaker": r["speaker"], "role": r["role"],
            "objective": objectives[0] if objectives else None,
            "session_id": str(r["session_id"]) if r["session_id"] else None,
        })

    interviews = await pool.fetchval(
        """select count(*) from interview_sessions
           where workspace_id = $1 and session_kind = 'interview' and status = 'completed'""",
        workspace_id,
    )
    records = await pool.fetchval(
        "select count(*) from client_visible_claims where workspace_id = $1", workspace_id
    )

    return {
        "conflicts": conflicts,
        "key_findings": key_findings,
        "admissions": admissions,
        "stats": {
            "interviews": interviews or 0,
            "records": records or 0,
            "conflicts": sum(1 for c in conflicts if c["kind"] != "perception_gap"),
            "gaps": sum(1 for c in conflicts if c["kind"] == "perception_gap"),
        },
    }


@router.get("/{workspace_id}/automation")
async def automation_opportunities(workspace_id: str):
    """Automation Opportunities (Kaan F2+3): the latest assessor batch. Each row cites
    the claim records it rests on (structurally guaranteed non-empty) and carries its
    ROI as an is_estimate object — the UI renders it as an estimate, never as fact."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, title, summary, signals, claim_ids, workflow_id, step_ids, roi
           from automation_opportunities
           where workspace_id = $1
             and render_batch = (select coalesce(max(render_batch), 0)
                                 from automation_opportunities where workspace_id = $1)
           order by created_at""",
        workspace_id,
    )
    return [
        {"id": str(r["id"]), "title": r["title"], "summary": r["summary"],
         "signals": _loads(r["signals"]) or [], "claim_ids": _loads(r["claim_ids"]) or [],
         "workflow_id": str(r["workflow_id"]) if r["workflow_id"] else None,
         "step_ids": _loads(r["step_ids"]) or [], "roi": _loads(r["roi"])}
        for r in rows
    ]


# ── F7 BETA: the context call (marathon shift 2, docs/F7-WIRING.md) ─────────
# The founder/admin does the Stage-3 context call WITH the product instead of
# uploading a transcript. Kind 'context' binds the context-collector persona in the
# turn engine and is NOT skipped by compile — the transcript feeds the same pipeline
# as an uploaded CEO call. Gated per workspace by the creation-time beta flag.


@router.post("/{workspace_id}/context-call")
async def start_context_call(workspace_id: str):
    import secrets

    pool = await get_pool()
    row = await pool.fetchrow(
        "select name, config from workspaces where id = $1", workspace_id
    )
    if row is None:
        raise HTTPException(404, "workspace not found")
    config = _loads(row["config"]) or {}
    if not config.get("beta_context_call"):
        raise HTTPException(403, "the context call beta is not enabled for this workspace")

    # The CEO is the speaker of this call — resolve the founder entity exactly like the
    # discovery upload does, so the compiled records attribute their words correctly.
    speaker = (config.get("contact_person") or "Founder").strip()
    ceo_id, _ = await entities.resolve_or_create(workspace_id, speaker, role="Founder")

    token = secrets.token_urlsafe(24)
    await pool.execute(
        """insert into interview_sessions
             (workspace_id, interviewee_id, modality, language, invite_token, status, session_kind)
           values ($1, $2, 'voice', 'en', $3, 'pending', 'context')""",
        workspace_id, ceo_id, token,
    )
    return {"token": token, "invite_path": f"/i/{token}"}


# ── Weekly Pulse (F3, marathon July 8) ──────────────────────────────────────
# OFF by default, per-workspace toggle in config. The digest is composed
# DETERMINISTICALLY from the week's records delta (no LLM seat): what changed is a
# database fact, and a client-forwardable text must not hallucinate. The WhatsApp text
# is built server-side so the copy has one testable source. No auto-sending anywhere.

class PulseConfigIn(BaseModel):
    enabled: bool


@router.put("/{workspace_id}/pulse-config")
async def set_pulse_config(workspace_id: str, body: PulseConfigIn):
    """Flip the per-workspace Weekly Pulse toggle (stored in workspaces.config)."""
    pool = await get_pool()
    row = await pool.fetchrow("select config from workspaces where id = $1", workspace_id)
    if row is None:
        raise HTTPException(404, "workspace not found")
    config = _loads(row["config"]) or {}
    config["weekly_pulse"] = body.enabled
    await pool.execute(
        "update workspaces set config = $2 where id = $1", workspace_id, json.dumps(config)
    )
    return {"enabled": body.enabled}


@router.post("/{workspace_id}/snapshot-intro-seen")
async def mark_snapshot_intro_seen(workspace_id: str):
    """SIMPLIFY B: persist the one-time 'company snapshot ready' intro dismissal in
    workspaces.config (same jsonb-merge path as the pulse toggle). Idempotent — the intro
    renders once, then Home shows the snapshot directly on every later visit."""
    pool = await get_pool()
    row = await pool.fetchrow("select config from workspaces where id = $1", workspace_id)
    if row is None:
        raise HTTPException(404, "workspace not found")
    config = _loads(row["config"]) or {}
    config["snapshot_intro_seen"] = True
    await pool.execute(
        "update workspaces set config = $2 where id = $1", workspace_id, json.dumps(config)
    )
    return {"snapshot_intro_seen": True}


def _trim(text: str, n: int = 140) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


@router.get("/{workspace_id}/pulse")
async def weekly_pulse(workspace_id: str):
    """The Monday digest: last 7 days of records delta. Role-only attribution (the
    copyable text is built to be forwarded). Returns enabled=false with no digest work
    skipped — the admin preview should render even while the toggle is off."""
    pool = await get_pool()
    ws = await pool.fetchrow(
        "select name, config from workspaces where id = $1", workspace_id
    )
    if ws is None:
        raise HTTPException(404, "workspace not found")
    enabled = bool((_loads(ws["config"]) or {}).get("weekly_pulse", False))

    new_claims = await pool.fetch(
        """select c.claim_text, c.topic, e.role
           from client_visible_claims c
           left join entities e on e.id = c.speaker_id
           where c.workspace_id = $1 and c.created_at > now() - interval '7 days'
             and (c.tag is null or c.tag <> 'SCRAPED')
           order by c.created_at desc""",
        workspace_id,
    )
    new_interviews = await pool.fetchval(
        """select count(*) from interview_sessions
           where workspace_id = $1 and session_kind = 'interview'
             and status = 'completed' and created_at > now() - interval '7 days'""",
        workspace_id,
    )
    conflict_rows = await pool.fetch(
        """select k.kind, k.resolution from claim_conflicts k
           join client_visible_claims a on a.id = k.claim_a_id
           join client_visible_claims b on b.id = k.claim_b_id
           where k.workspace_id = $1 and k.created_at > now() - interval '7 days'
           order by k.created_at desc""",
        workspace_id,
    )
    new_conflicts = []
    for r in conflict_rows:
        res = _loads(r["resolution"])
        note = (res.get("gap") or res.get("note")) if isinstance(res, dict) else None
        new_conflicts.append({"kind": r["kind"], "note": note})

    promises = await pool.fetch(
        """select item, status, delivered_at from artifact_promises
           where workspace_id = $1
             and (created_at > now() - interval '7 days'
                  or delivered_at > now() - interval '7 days'
                  or status = 'promised')
           order by created_at desc""",
        workspace_id,
    )
    kept = [p["item"] for p in promises
            if p["status"] == "delivered" and p["delivered_at"] is not None]
    pending = [p["item"] for p in promises if p["status"] == "promised"]

    # One suggested next step, same derivation the Company Report uses: the renderer's
    # own open areas first, then an admission objective, then a suggested person.
    next_step = None
    cards = await pool.fetch(
        """select card_type, content from snapshot_cards
           where workspace_id = $1
             and render_batch = (select max(render_batch) from snapshot_cards where workspace_id = $1)
           order by card_type, id""",
        workspace_id,
    )
    for r in cards:
        if r["card_type"] == "area_to_investigate":
            title = (_loads(r["content"]) or {}).get("title")
            if title:
                next_step = f"Investigate: {title}"
                break
    if next_step is None:
        for r in cards:
            if r["card_type"] == "suggested_person":
                c = _loads(r["content"]) or {}
                if c.get("name"):
                    role = f" ({c['role']})" if c.get("role") else ""
                    next_step = f"Schedule an interview with {c['name']}{role}"
                    break

    learned = [
        {"text": _trim(r["claim_text"]), "topic": r["topic"], "role": r["role"]}
        for r in new_claims[:3]
    ]

    # WhatsApp-ready text: plain, forwardable, honest. WhatsApp *bold* is the only markup.
    lines = [f"*{ws['name']} weekly pulse*", ""]
    if new_claims:
        lines.append(f"What Nexus learned this week ({len(new_claims)} new records"
                     + (f" from {new_interviews} interviews" if new_interviews else "")
                     + "):")
        for item in learned:
            src = f" ({item['role']})" if item["role"] else ""
            lines.append(f"- {item['text']}{src}")
    else:
        lines.append("No new records this week.")
    lines.append("")
    if new_conflicts:
        lines.append(f"New conflicts found: {len(new_conflicts)}")
        for c in new_conflicts[:3]:
            if c["note"]:
                lines.append(f"- {_trim(c['note'])}")
    else:
        lines.append("No new conflicts this week.")
    lines.append("")
    if kept or pending:
        lines.append(f"Promises: {len(kept)} delivered, {len(pending)} still pending")
        for item in pending[:3]:
            lines.append(f"- pending: {_trim(item, 80)}")
        lines.append("")
    if next_step:
        lines.append(f"Suggested next step: {next_step}")

    return {
        "enabled": enabled,
        "workspace_name": ws["name"],
        "totals": {
            "new_records": len(new_claims),
            "new_interviews": new_interviews or 0,
            "new_conflicts": len(new_conflicts),
            "promises_kept": len(kept),
            "promises_pending": len(pending),
        },
        "learned": learned,
        "new_conflicts": new_conflicts[:3],
        "promises": {"kept": kept[:5], "pending": pending[:5]},
        "next_step": next_step,
        "whatsapp_text": "\n".join(lines).strip(),
    }


@router.get("/{workspace_id}/sessions")
async def list_sessions(workspace_id: str, kind: str = "interview"):
    """Interview sessions for a workspace — powers the Interviews list and lets the report
    find its compiled session (has_report = it produced a workflow). The interviewee name
    is resolved resiliently: a session created off a plan carries the plan's linked entity,
    but a session whose own interviewee_id was never set still resolves via the plan side,
    so the Interviews list never renders a nameless row (#16). session_kind travels so the
    caller can see why a session is or isn't client-facing. `kind` selects which class of
    session: 'interview' (default, client-facing) or 'eval' — the Simulations surface lists
    eval-kind runs explicitly; they never mix (0007 firewall)."""
    if kind not in ("interview", "eval", "context"):
        raise HTTPException(422, "unknown session kind")
    pool = await get_pool()
    rows = await pool.fetch(
        """select s.id, s.status, s.modality, s.session_kind, s.plan_id,
                  coalesce(se.canonical_name, pe.canonical_name) as interviewee,
                  coalesce(se.role, pe.role) as interviewee_role,
                  exists(select 1 from workflows w where w.session_id = s.id) as has_report
           from interview_sessions s
           left join entities se on se.id = s.interviewee_id
           left join interview_plans p on p.id = s.plan_id
           left join entities pe on pe.id = p.interviewee_id
           where s.workspace_id = $1 and s.session_kind = $2
           order by s.created_at""",
        workspace_id, kind,
    )
    return [dict(r) | {"id": str(r["id"]), "plan_id": str(r["plan_id"]) if r["plan_id"] else None}
            for r in rows]


class DiscoveryIn(BaseModel):
    transcript: str
    speaker_name: str | None = None   # who gave the call; defaults to the workspace contact
    speaker_role: str | None = None
    # 'interview' = CEO discovery call (default). 'people_map' = the stage-3 v04 branch:
    # a short intake with a named person who maps who-does-what; same verbatim + compile
    # path, but never relabels the workspace's founder/source (A24 merge). 'demo' = a
    # SYNTHETIC generated transcript (verdict 8): compiles normally but every record is
    # provenance-flagged synthetic and the founder/source is never relabeled.
    session_kind: str = "interview"


@router.post("/{workspace_id}/discovery")
async def upload_discovery(workspace_id: str, body: DiscoveryIn):
    """Upload a CEO discovery-call transcript and kick the STANDARD compile (A17 / #6).

    The transcript is stored verbatim as a completed founder-round interview session, then
    the normal compile_session job runs through the queue (API enqueues, worker executes —
    no shortcut path, no mock). We flag the job to render the snapshot when the round's
    records land, so the UI can poll /discovery/{session_id}/status and reveal cards as
    they compile. A12 holds: this only ever touches the real tenant it's posted to."""
    if not body.transcript.strip():
        raise HTTPException(422, "transcript is empty")
    if body.session_kind not in ("interview", "people_map", "demo"):
        raise HTTPException(422, "session_kind must be 'interview', 'people_map', or 'demo'")
    is_people_map = body.session_kind == "people_map"
    is_demo_synth = body.session_kind == "demo"
    pool = await get_pool()

    ws = await pool.fetchrow(
        "select id, config, is_internal from workspaces where id = $1", workspace_id
    )
    if ws is None:
        raise HTTPException(404, "workspace not found")

    config = _loads(ws["config"]) or {}
    if is_people_map:
        # The people-map subject is a NAMED person ("ask Meltem, she runs Izmir"), never
        # a founder default — an unnamed people-map intake is a data-entry error.
        if not (body.speaker_name or "").strip():
            raise HTTPException(422, "people_map upload requires speaker_name")
        speaker = body.speaker_name.strip()
        role = (body.speaker_role or "Line manager").strip()
    elif is_demo_synth:
        # Synthetic call: never mint the REAL founder/contact as the speaker of made-up
        # claims — the example entity is labeled as such at the data layer too.
        speaker = (body.speaker_name or "").strip() or "Example CEO (synthetic)"
        role = (body.speaker_role or "Founder (example)").strip()
    else:
        speaker = (body.speaker_name or config.get("contact_person") or "Founder").strip()
        role = (body.speaker_role or "Founder").strip()

    # The founder is the interviewee of the discovery call (source='interview' — their own
    # words, not scraped). resolve_or_create keeps it idempotent across re-uploads.
    ceo_id, _ = await entities.resolve_or_create(workspace_id, speaker, role=role)

    round_id = await pool.fetchval(
        "insert into interview_rounds (workspace_id, label, status) "
        "values ($1, $2, 'open') returning id",
        workspace_id,
        "People-map interview" if is_people_map
        else "Example call (synthetic)" if is_demo_synth
        else "CEO discovery call",
    )
    session_id = await pool.fetchval(
        """insert into interview_sessions
             (workspace_id, round_id, interviewee_id, modality, status, language,
              session_kind, ended_at)
           values ($1, $2, $3, 'text', 'completed', 'en', $4, now())
           returning id""",
        workspace_id, round_id, ceo_id, body.session_kind,
    )

    turns = parse_transcript(body.transcript)  # verbatim — hedges/fillers preserved
    for t in turns:
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,$3,$4)",
            session_id, t["turn_index"], t["speaker"], t["text"],
        )

    if not is_people_map and not is_demo_synth:
        # Surface the meeting owner + source on the snapshot header (honest — it IS this
        # call). A people-map intake or a synthetic demo call never relabels the founder
        # or the snapshot source.
        config["founder"] = config.get("founder") or speaker
        config["founder_role"] = config.get("founder_role") or role
        config["source"] = "CEO Discovery Call"
        await pool.execute(
            "update workspaces set config = $2 where id = $1", workspace_id, json.dumps(config)
        )

    job_id = await enqueue(
        "compile_session",
        {"session_id": str(session_id), "render_snapshot": True, "round_id": str(round_id)},
    )
    return {
        "session_id": str(session_id),
        "round_id": str(round_id),
        "job_id": job_id,
        "turns": len(turns),
    }


@router.post("/{workspace_id}/demo-transcript")
async def generate_demo_transcript(workspace_id: str):
    """Generate a clearly-synthetic example CEO-call transcript for THIS company (Kaan
    verdict 8) so the compile flow can be demoed live on any workspace. Returns the
    transcript for the upload textarea; nothing compiles until the admin submits it —
    and when they do, the 'demo' session kind flags every record synthetic at the data
    layer (compile_session), never by caller discipline."""
    pool = await get_pool()
    ws = await pool.fetchrow(
        "select id, name, industry, config from workspaces where id = $1", workspace_id
    )
    if ws is None:
        raise HTTPException(404, "workspace not found")
    config = _loads(ws["config"]) or {}
    from ..llm import run_agent
    from ..pipeline.compiler import _load_industry_block

    user_content = (
        f"# Company\nName: {ws['name']}\nIndustry: {ws['industry'] or 'unspecified'}\n"
        + (f"Website: {config.get('website')}\n" if config.get("website") else "")
        + "\nWrite the synthetic example CEO-call transcript now."
    )
    raw = await run_agent(
        "demo_transcript", user_content, workspace_id=workspace_id,
        industry_block=_load_industry_block(ws["industry"]), max_tokens=3000,
    )
    return {"transcript": raw.strip(), "synthetic": True, "session_kind": "demo"}


@router.get("/{workspace_id}/discovery/{session_id}/status")
async def discovery_status(workspace_id: str, session_id: str):
    """Honest progress for the compile of one discovery session (#6). Reads the real jobs
    table + record/card counts — no fabricated percentages. The UI polls this to animate
    cards in as claims compile and the snapshot renders."""
    pool = await get_pool()

    # Every fan-out job carries session_id in its payload (render_snapshot too), so one
    # query captures the whole pipeline for this session.
    job_rows = await pool.fetch(
        "select kind, status from jobs where payload->>'session_id' = $1", session_id
    )
    by_kind = {r["kind"]: r["status"] for r in job_rows}
    stages = [{"kind": k, "status": by_kind.get(k, "pending")} for k in _DISCOVERY_STAGES]

    claims = await pool.fetchval(
        "select count(*) from claim_records where session_id = $1", session_id
    ) or 0
    cards = await pool.fetchval(
        """select count(*) from snapshot_cards where workspace_id = $1
           and render_batch = (select max(render_batch) from snapshot_cards
                               where workspace_id = $1)""",
        workspace_id,
    ) or 0

    any_failed = any(s["status"] == "failed" for s in stages)
    render_done = by_kind.get("render_snapshot") == "done"
    state = "failed" if any_failed else ("done" if render_done else "running")

    return {
        "session_id": session_id,
        "state": state,
        "stages": stages,
        "claims": claims,
        "cards": cards,
    }


class ReconIn(BaseModel):
    website_url: str | None = None
    linkedin: dict | None = None   # {actor_id, input} for the Apify people scrape
    fixtures: dict | None = None   # {website_markdown, linkedin_people} — demo path, no live scrape


@router.post("/{workspace_id}/recon")
async def trigger_recon(workspace_id: str, body: ReconIn):
    """Kick Stage 1 recon (→ SCRAPED records + client people pool → Stage 2 heuristics).
    Live scrape unless fixtures are supplied (demo runs on fixtures, A11.3)."""
    job_id = await enqueue(
        "run_recon",
        {"workspace_id": workspace_id, "website_url": body.website_url,
         "linkedin": body.linkedin, "fixtures": body.fixtures},
    )
    return {"enqueued": "run_recon", "job_id": job_id}


@router.get("/{workspace_id}/recon/status")
async def recon_status(workspace_id: str, job_id: int):
    """Best-effort recon progress for the website-scan button (#7). Reports the run_recon
    job's real state plus how many SCRAPED reference records + scraped people it produced.
    A scrape that reaches nothing (no key, unreachable site) completes as 'done' with zero
    records — the UI reads that as "found nothing", never as a hard error."""
    pool = await get_pool()
    job = await pool.fetchrow("select status from jobs where id = $1", job_id)
    scraped = await pool.fetchval(
        "select count(*) from claim_records where workspace_id = $1 and tag = 'SCRAPED'",
        workspace_id,
    ) or 0
    people = await pool.fetchval(
        "select count(*) from entities where workspace_id = $1 and source = 'scraped'",
        workspace_id,
    ) or 0
    return {
        "job_status": job["status"] if job else "unknown",
        "scraped_records": scraped,
        "people": people,
    }
