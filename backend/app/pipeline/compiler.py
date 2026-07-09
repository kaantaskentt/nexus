"""Stage 4 compiler job — transcript in → claim records out.

Judgment lives in prompts/agents/stage4-compiler.md (the IP). This module owns the
machine contract: it hands the agent the transcript + prior-record context + the
exact output schema, then persists the result under the ontology's invariants:

  - Tags never upgrade; records are immutable. Corrections SUPERSEDE via a new row
    (the 40→10 canonical case), enforced by the DB trigger — we never edit.
  - Sentiment about a named person is quarantined at insert (DB trigger force-locks
    it); a fact+judgment utterance arrives as two records, we honor both.
  - SCRAPED context is reference only; the compiler tags, it never re-weights here.
  - Vendor entities are never minted from a client transcript (see entities.py).
"""

import json
import logging
import re

from ..config import REPO_ROOT
from ..db import get_pool
from ..embeddings import embed, to_pgvector
from ..llm import run_agent
from ..queue import handles
from . import entities

log = logging.getLogger("nexus.compiler")


def _should_render_snapshot(session, payload: dict) -> bool:
    """Whether this compile should auto-render the snapshot (A17 discovery / #6).

    Guardrail (A3, team-lead directive): the auto-render is for the CEO/discovery call
    ONLY — never a general per-session trigger. Employee interviews must not re-render a
    snapshot mid-round (attribution risk), and they ALWAYS originate from an approved plan,
    so a null plan_id is the structural signal that this is the founder's own discovery
    call. Both conditions must hold: the caller asked, AND the session is plan-less.
    """
    return bool(payload.get("render_snapshot")) and session["plan_id"] is None

_TOPIC = {
    "pain": "pain",
    "process-step": "process_step",
    "process_step": "process_step",
    "person": "person",
    "tool": "tool",
    "vocabulary": "vocabulary",
    "time-or-cost": "time_or_cost",
    "time_or_cost": "time_or_cost",
    "company-fact": "company_fact",
    "company_fact": "company_fact",
    "success-criteria": "success_criteria",
    "success_criteria": "success_criteria",
}
_KIND = {"statement", "directive", "admission", "correction"}
_TAG = {"guess": "GUESS", "claimed": "CLAIMED", "confirmed": "CONFIRMED"}
# Kinds that are not points on the trust ladder carry a null tag (migration 0002).
_UNTAGGED_KINDS = {"directive", "admission"}
# Trust ladder rank for capping unverified sources (e.g. admin "add as context",
# which is one person's account and may never compile above CLAIMED).
_TAG_RANK = {"SCRAPED": 0, "GUESS": 1, "CLAIMED": 2, "CONFIRMED": 3, "VERIFIED": 4}


def _cap_tag(tag: str | None, max_tag: str | None) -> str | None:
    if tag is None or max_tag is None:
        return tag
    return max_tag if _TAG_RANK.get(tag, 0) > _TAG_RANK.get(max_tag, 4) else tag

OUTPUT_CONTRACT = """
## Output — return ONE json object, nothing else

```json
{
  "records": [
    {
      "id": "r1",                       // stable LOCAL id for this call; referenced below
      "kind": "statement|directive|admission|correction",
      "topic": "pain|process-step|person|tool|vocabulary|time-or-cost|company-fact|success-criteria",
      "tag": "guess|claimed|confirmed|null",   // null for directive/admission
      "claim": "one clean sentence, third person",
      "evidence": {"quote": "verbatim, untranslated", "timestamp": "MM:SS or #turn", "speaker": "name"},
      "speaker_name": "who said it (for entity resolution)",
      "subject_name": "the person this claim is ABOUT, or null",
      "hedges": ["sanırım", "maybe"],          // the hedge tokens that forced GUESS, if any
      "flags": {"sentiment_quarantine": false, "approach_note": false},
      "approach_note": null,                    // text when flags.approach_note is true
      "supersedes": null,                       // local id (this call) OR a prior-record UUID this corrects
      "triggers": ["NEW-PERSON: ...", "INTERVIEW-OBJECTIVE: ..."]
    }
  ],
  "mentions": [
    {"of": "r1", "quote": "verbatim repeat", "timestamp": "MM:SS"}   // a repeat of an already-recorded claim; bumps its mention_count. NOT a new record.
  ]
}
```

Rules for the machine layer (the judgment rules are in your system prompt):
- Every record needs a unique local `id` (r1, r2, ...). `supersedes` and `mentions[].of` reference either a local id from THIS output or a prior-record UUID from the context block.
- A correction MUST set `supersedes` to the id of the record it corrects — never emit a correction with `supersedes: null`. If the corrected value was stated earlier in THIS call (even earlier in the same sentence — "it takes forty minutes... actually, ten"), emit BOTH the original value as its own record AND the correction pointing `supersedes` at that original's local id. If the corrected value came from a prior session or a SCRAPED record in the context block, point `supersedes` at that record's UUID. Both records always survive; you never edit or drop the superseded one.
- A repeat of something already recorded goes in `mentions`, never as a duplicate record.
- Filler is silently dropped — never a record.
"""


def _transcript_block(utterances: list[dict]) -> str:
    lines = []
    for u in utterances:
        ts = f"{u['turn_index']:02d}"
        lines.append(f"[#{ts} · {u['speaker']}] {u['text']}")
    return "\n".join(lines)


async def _prior_context(workspace_id: str, session_id: str | None) -> str:
    """Prior records (incl. SCRAPED) for supersede / mention / conflict reference.
    Passed with real UUIDs so a correction can supersede across sessions/scrape."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, kind, topic, tag, claim_text from claim_records
           where workspace_id = $1 and ($2::uuid is null or session_id is distinct from $2::uuid)
           order by created_at desc limit 80""",
        workspace_id,
        session_id,
    )
    if not rows:
        return "(no prior records)"
    return "\n".join(
        f"{r['id']} · {r['kind']}/{r['topic']}/{r['tag']} · {r['claim_text']}" for r in rows
    )


def _load_industry_block(industry: str | None) -> str | None:
    if not industry:
        return None
    path = REPO_ROOT / "prompts" / "examples" / f"{industry}.md"
    return path.read_text() if path.exists() else None


def parse_compiler_output(text: str) -> dict:
    """Tolerant JSON extraction — the model may wrap the object in prose or a fence."""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    blob = m.group(1) if m else None
    if blob is None:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("compiler returned no JSON object")
        blob = text[start : end + 1]
    data = json.loads(blob)
    data.setdefault("records", [])
    data.setdefault("mentions", [])
    return data


_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _is_uuid(s: str | None) -> bool:
    return bool(s and _UUID_RE.match(s))


# Generic conversation-role labels are never people — don't mint entities from them.
_GENERIC_LABELS = {"respondent", "agent", "interviewer", "interviewee", "user", "speaker"}


def _is_real_name(name: str | None) -> bool:
    return bool(name and name.strip() and name.strip().lower() not in _GENERIC_LABELS)


async def compile_session(payload: dict) -> None:
    """Job handler: compile one interview session's verbatim utterances into records."""
    session_id = payload["session_id"]
    pool = await get_pool()

    session = await pool.fetchrow(
        "select s.*, w.industry from interview_sessions s "
        "join workspaces w on w.id = s.workspace_id where s.id = $1",
        session_id,
    )
    if session is None:
        raise RuntimeError(f"compile_session: no session {session_id}")
    # A voice test is the admin auditioning the assistant — never data. Nothing it said
    # may enter the record store (premium audit P1-3); the guard lives here, at the one
    # choke point every completion path funnels through.
    if session["session_kind"] == "voice_test":
        log.info("compile_session: %s is a voice_test session — skipping compile", session_id)
        return
    workspace_id = str(session["workspace_id"])
    default_speaker_id = session["interviewee_id"]
    # Unverified sources cap here: admin "add as context" compiles CLAIMED-at-best,
    # never CONFIRMED/VERIFIED (V2-PLAN #20). None = the normal transcript path.
    max_tag = payload.get("max_tag")

    utterances = await pool.fetch(
        "select turn_index, speaker, text from utterances "
        "where session_id = $1 order by turn_index",
        session_id,
    )
    if not utterances:
        raise RuntimeError(f"compile_session: session {session_id} has no utterances")

    user_content = (
        "# Transcript to compile\n\n"
        + _transcript_block([dict(u) for u in utterances])
        + "\n\n# Prior records (for supersede / mention reference, real UUIDs)\n"
        + await _prior_context(workspace_id, session_id)
        + "\n\n"
        + OUTPUT_CONTRACT
    )

    raw = await run_agent(
        "stage4_compiler",
        user_content,
        workspace_id=workspace_id,
        session_id=session_id,
        industry_block=_load_industry_block(session["industry"]),
        max_tokens=16000,
    )
    data = parse_compiler_output(raw)
    records = data["records"]
    mentions = data["mentions"]

    # ── Pass 0: local id → real UUID map, and mention_count from same-batch repeats.
    import uuid as _uuid

    local_to_uuid: dict[str, str] = {}
    for rec in records:
        local_to_uuid[rec.get("id") or f"r{len(local_to_uuid)+1}"] = str(_uuid.uuid4())

    mention_bumps: dict[str, int] = {}  # target ref (local id or UUID) → count
    for men in mentions:
        ref = men.get("of")
        if ref:
            mention_bumps[ref] = mention_bumps.get(ref, 0) + 1

    def _resolve_ref(ref: str | None) -> str | None:
        if ref is None:
            return None
        if ref in local_to_uuid:
            return local_to_uuid[ref]
        return ref if _is_uuid(ref) else None

    # ── Pass 1: resolve entities + insert every record (supersedes set to null first).
    new_person_names: list[str] = []
    for rec in records:
        rid = rec.get("id")
        real_id = local_to_uuid[rid] if rid in local_to_uuid else str(_uuid.uuid4())

        kind = (rec.get("kind") or "statement").lower()
        if kind not in _KIND:
            kind = "statement"
        topic = _TOPIC.get((rec.get("topic") or "").lower())
        if topic is None:
            topic = "company_fact"  # never drop a record over a bad topic label
        raw_tag = (str(rec.get("tag")) or "").lower()
        tag = None if kind in _UNTAGGED_KINDS else _cap_tag(_TAG.get(raw_tag), max_tag)

        flags = rec.get("flags") or {}
        sentiment = bool(flags.get("sentiment_quarantine"))
        has_approach = bool(flags.get("approach_note"))
        approach_note = rec.get("approach_note") if has_approach else None

        # Entity resolution. The speaker is the KNOWN interviewee — we never mint an
        # entity from a speaker label (else generic "respondent"/"agent" become people).
        # Only SUBJECT names — people the transcript talks about — mint NEW-PERSON.
        speaker_id = default_speaker_id
        if speaker_id is None and _is_real_name(rec.get("speaker_name")):
            speaker_id, _ = await entities.resolve_or_create(workspace_id, rec["speaker_name"])
        subject_id = None
        if _is_real_name(rec.get("subject_name")):
            subject_id, is_new = await entities.resolve_or_create(
                workspace_id, rec["subject_name"]
            )
            if is_new:
                new_person_names.append(rec["subject_name"])

        evidence = rec.get("evidence") or {}
        mention_count = 1 + mention_bumps.get(rid, 0)
        emb = to_pgvector(await embed(rec.get("claim") or ""))
        provenance = {
            "triggers": rec.get("triggers") or [],
            "speaker_name": rec.get("speaker_name"),
            "subject_name": rec.get("subject_name"),
        }
        # Synthetic firewall at the record level (verdict 8 / A12 principle): a 'demo'
        # session's records carry the label STRUCTURALLY — derived from the session kind
        # here, never from caller discipline — so generated example data can never blend
        # unlabeled into real records.
        if session["session_kind"] == "demo":
            provenance["synthetic"] = True

        await pool.execute(
            """insert into claim_records
                 (id, workspace_id, session_id, speaker_id, subject_id, kind, topic, tag,
                  claim_text, evidence_quote, evidence_ts, hedge_signals, sentiment_flag,
                  approach_note, mention_count, provenance, embedding)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)""",
            real_id,
            workspace_id,
            session_id,
            speaker_id,
            subject_id,
            kind,
            topic,
            tag,
            rec.get("claim") or "",
            evidence.get("quote"),
            evidence.get("timestamp"),
            json.dumps(rec.get("hedges") or []),
            sentiment,
            approach_note,
            mention_count,
            json.dumps(provenance),
            emb,
        )

    # ── Pass 2: wire supersedes now that every row exists (supersedes_id is mutable;
    # the immutability trigger guards tag/text/kind/quarantine only, not this link).
    for rec in records:
        target = _resolve_ref(rec.get("supersedes"))
        if target:
            await pool.execute(
                "update claim_records set supersedes_id = $2 where id = $1",
                local_to_uuid[rec["id"]],
                target,
            )

    # ── Pass 3: bump mention_count on prior-session records referenced by UUID.
    for ref, count in mention_bumps.items():
        if _is_uuid(ref) and ref not in local_to_uuid.values():
            await pool.execute(
                "update claim_records set mention_count = mention_count + $2 where id = $1",
                ref,
                count,
            )

    # Post-compile fan-out (all async — none of this sits in an interview reply path).
    # Ordered by report-criticality: on a single worker the queue is serial, so the
    # jobs the report screen needs first (workflow, quality, pain) run ahead of the
    # heavier, less time-critical passes. detect_conflicts does two LLM passes over
    # every record — on a 50+ claim interview that's the slowest job, and its output
    # (conflicts / perception gaps) is report-only and often needs a 2nd interview
    # anyway — so it runs LAST (higher priority number = later). Run multiple workers
    # to parallelize the fan-out; the ordering just makes a single worker feel fast.
    from ..queue import enqueue

    await enqueue("build_workflow_schema", {"session_id": session_id}, priority=90)
    await enqueue("score_interview_quality", {"session_id": session_id}, priority=90)
    await enqueue("rate_pain", {"workspace_id": workspace_id, "session_id": session_id}, priority=95)
    # Stage 2: score pre-call heuristics against what the call actually surfaced (F13).
    await enqueue("score_heuristics", {"workspace_id": workspace_id, "session_id": session_id}, priority=100)
    # Question yield + final coverage audit (Emre stage-7 §10, A24): analytics-grade,
    # deterministic core, so it rides after the report-critical jobs.
    await enqueue("compute_yield", {"session_id": session_id}, priority=120)
    await enqueue("detect_conflicts", {"workspace_id": workspace_id, "session_id": session_id}, priority=150)
    # Automation opportunities (Kaan F2+3): evidence-only assessor, rides after conflicts.
    await enqueue("assess_automation", {"workspace_id": workspace_id}, priority=160)

    # Opt-in snapshot render (A17 discovery upload / #6): a single-call founder round
    # auto-completes and renders once its records land. Runs LAST (priority 200, after
    # conflicts) so the snapshot reflects the full record set. The gate is structural
    # (plan-less discovery call only) — an employee interview never auto-renders here even
    # if the flag were set, preserving A3 round-batching.
    if payload.get("render_snapshot") and not _should_render_snapshot(session, payload):
        log.warning(
            "compile_session: render_snapshot requested for plan-backed session %s "
            "(plan_id=%s) — refusing per A3 (employee interviews never auto-render)",
            session_id, session["plan_id"],
        )
    if _should_render_snapshot(session, payload):
        round_id = session["round_id"]
        if round_id:
            await pool.execute(
                "update interview_rounds set status = 'completed', completed_at = now() "
                "where id = $1 and status <> 'completed'",
                round_id,
            )
        await enqueue(
            "render_snapshot",
            {"workspace_id": workspace_id, "round_id": str(round_id) if round_id else None,
             "session_id": session_id},
            priority=200,
        )

    # Close the plan lifecycle: its records are compiled (YC-AUDIT #7). Local import —
    # routers.plans imports this module, so a top-level import would cycle. Forward-only
    # and idempotent, so a plan-less discovery call or a re-compile is a safe no-op.
    from ..routers.plans import reconcile_plan_state

    await reconcile_plan_state(pool, session["plan_id"], "COMPILED", "interview compiled")


@handles("compile_session")
async def _compile_session_job(payload: dict) -> None:
    await compile_session(payload)
