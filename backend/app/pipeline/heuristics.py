"""Stage 2 heuristics (Phase 2). A heuristic is a FALSIFIABLE prior you expect to be
wrong a fair share of the time (A1) — direction for the interview, never an assertion
to the respondent. Generated pre-call from the SCRAPED recon layer; scored post-call
against compiled records, and credited confirmed ONLY when the respondent raised it
unprompted (F13 — a fished-for yes is not a confirm)."""

import logging

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles

log = logging.getLogger("nexus.heuristics")

_GEN = (
    'From the SCRAPED recon records below, return a JSON array of falsifiable heuristics: '
    '[{"heuristic":"one falsifiable sentence","predicts":["..."],"topic":"pain|process-step|tool|person|time-or-cost",'
    '"prior_confidence":"low|medium","verification_objective":"the one question that tests it"}]. '
    "Each must be provable wrong by a single interview answer (F12). Never high confidence."
)
_SCORE = (
    'Score each open heuristic against the compiled records. Return a JSON array: '
    '[{"heuristic_id":"id","status":"confirmed|busted|partial|untouched","raised_unprompted":true,'
    '"evidence_record_ids":["id"]}]. '
    "confirmed ONLY if a record supports it AND the respondent raised it unprompted (F13). "
    "busted (a record contradicts it) is a good outcome. partial if supported only after prompting."
)
_VALID = {"confirmed", "busted", "partial", "untouched"}


async def generate_heuristics(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    pool = await get_pool()
    scraped = await pool.fetch(
        "select claim_text from claim_records where workspace_id = $1 and tag = 'SCRAPED'",
        workspace_id,
    )
    if not scraped:
        log.info("no scraped records to seed heuristics for %s", workspace_id)
        return
    lines = "\n".join(f"- {r['claim_text']}" for r in scraped)
    items = await run_agent_json("stage2_heuristics", f"SCRAPED records:\n{lines}\n\n{_GEN}",
                                 workspace_id=workspace_id)
    for h in items:
        if not h.get("heuristic"):
            continue
        falsifiable = h.get("verification_objective") or "; ".join(h.get("predicts") or []) or "(unspecified)"
        await pool.execute(
            "insert into heuristics (workspace_id, text, falsifiable_as) values ($1,$2,$3)",
            workspace_id, h["heuristic"], falsifiable,
        )


async def score_heuristics(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    session_id = payload.get("session_id")
    pool = await get_pool()
    open_h = await pool.fetch(
        "select id, text, falsifiable_as from heuristics where workspace_id = $1 and status = 'open'",
        workspace_id,
    )
    if not open_h:
        return
    records = await pool.fetch(
        """select id, kind, topic, tag, claim_text from client_visible_claims
           where workspace_id = $1 and ($2::uuid is null or session_id = $2::uuid)""",
        workspace_id, session_id,
    )
    if not records:
        return
    h_lines = "\n".join(f"{h['id']} · {h['text']} (tests: {h['falsifiable_as']})" for h in open_h)
    r_lines = "\n".join(f"{r['id']} · {r['kind']}/{r['topic']}/{r['tag']} · {r['claim_text']}" for r in records)
    valid_h = {str(h["id"]) for h in open_h}
    valid_r = {str(r["id"]) for r in records}
    scored = await run_agent_json(
        "stage2_heuristics",
        f"Open heuristics:\n{h_lines}\n\nCompiled records:\n{r_lines}\n\n{_SCORE}",
        workspace_id=workspace_id, session_id=session_id,
    )
    for s in scored:
        hid = s.get("heuristic_id")
        status = s.get("status")
        if hid not in valid_h or status not in _VALID or status == "untouched":
            continue
        evidence = [e for e in (s.get("evidence_record_ids") or []) if e in valid_r]
        await pool.execute(
            """update heuristics set status = $2, raised_unprompted = $3,
                 evidence_claim_ids = $4, scored_at = now()
               where id = $1 and status = 'open'""",
            hid, status, bool(s.get("raised_unprompted")), evidence,
        )


@handles("generate_heuristics")
async def _generate_heuristics_job(payload: dict) -> None:
    await generate_heuristics(payload)


@handles("score_heuristics")
async def _score_heuristics_job(payload: dict) -> None:
    await score_heuristics(payload)
