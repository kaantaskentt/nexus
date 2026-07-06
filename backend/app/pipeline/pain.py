"""Pain rater — LLM-judged bands over topic=pain claims (A2: judged, never a
formula; never decimals — the enum enforces coarse bands). Quarantined records are
excluded (they never feed pain scores — non-negotiable #4).

The rubric prompts/rubrics/pain-bands.md is prompts-evals' lane. If it isn't on
disk yet the job logs and skips rather than failing — pain bands populate once the
rubric lands; nothing else in the pipeline blocks on it."""

import json
import logging
import re

from ..config import REPO_ROOT
from ..db import get_pool
from ..llm import get_agent_config, run_agent
from ..queue import handles

log = logging.getLogger("nexus.pain")
_BANDS = {"low", "moderate", "high", "severe"}


def _parse_band(text: str) -> tuple[str, str] | None:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            d = json.loads(m.group(0))
            band = str(d.get("band", "")).lower().strip()
            if band in _BANDS:
                return band, str(d.get("rationale", "")).strip()
        except json.JSONDecodeError:
            pass
    for b in _BANDS:  # fallback: a bare band word in prose
        if re.search(rf"\b{b}\b", text, re.IGNORECASE):
            return b, text.strip()[:280]
    return None


async def rate_pain(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    session_id = payload.get("session_id")

    cfg = await get_agent_config("pain_rater")
    if not (REPO_ROOT / cfg["prompt_path"]).exists():
        log.warning("pain rater skipped — %s not on disk yet", cfg["prompt_path"])
        return

    pool = await get_pool()
    rows = await pool.fetch(
        """select c.id, c.claim_text, c.evidence_quote, c.mention_count
           from client_visible_claims c
           left join pain_scores p on p.claim_id = c.id
           where c.workspace_id = $1 and c.topic = 'pain' and p.id is null
             and ($2::uuid is null or c.session_id = $2::uuid)""",
        workspace_id,
        session_id,
    )
    for r in rows:
        content = (
            f"Claim: {r['claim_text']}\n"
            f"Evidence quote: {r['evidence_quote'] or '(none)'}\n"
            f"Mention count: {r['mention_count']}\n\n"
            'Return json: {"band": "low|moderate|high|severe", "rationale": "one line"}'
        )
        out = await run_agent(
            "pain_rater", content, workspace_id=workspace_id, session_id=session_id
        )
        parsed = _parse_band(out)
        if parsed is None:
            log.warning("pain rater returned no band for claim %s", r["id"])
            continue
        band, rationale = parsed
        await pool.execute(
            """insert into pain_scores (claim_id, band, rationale, rater_version)
               values ($1, $2, $3, $4) on conflict (claim_id) do nothing""",
            r["id"],
            band,
            rationale or "(no rationale)",
            cfg["prompt_version"],
        )


@handles("rate_pain")
async def _rate_pain_job(payload: dict) -> None:
    await rate_pain(payload)
