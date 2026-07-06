"""Conflict + perception-gap engine (Phase 6). Runs post-compile, async — never in
the interview reply path.

Two LLM passes over the workspace's client-visible records (quarantined rows never
enter): the collision detector links any two records that can't both be true, and the
perception-gap comparator finds where leadership's belief diverges from the floor's
lived account. Both LINK, never resolve — both records survive as DISPUTED
(non-negotiable #1). Perception gaps are report-only (F27); the report endpoint gates
their visibility, not this job.

F21 precedence is PROVISIONAL (episodic beats habitual, firsthand beats secondhand)
until Emre delivers the final policy — it's isolated in precedence_lean() below so the
swap is one function, and it only annotates a lean, never hard-resolves a conflict."""

import json
import logging

from ..db import get_pool
from ..llm import extract_json, get_agent_config, run_agent
from ..queue import handles
from ..config import REPO_ROOT

log = logging.getLogger("nexus.conflicts")

_TAG_RANK = {None: -1, "SCRAPED": 0, "GUESS": 1, "CLAIMED": 2, "CONFIRMED": 3, "VERIFIED": 4}
_COLLISION_KIND = {
    "ceo-vs-floor": "ceo_vs_floor", "worker-vs-worker": "worker_vs_worker",
    "now-vs-prior": "now_vs_prior", "call-vs-scrape": "call_vs_scrape",
}


def precedence_lean(a: dict, b: dict) -> dict | None:
    """PROVISIONAL F21 (pending Emre). Favors the more reliable account FOR FRAMING
    only — both records survive. Approximated by trust-ladder rank (CONFIRMED-episodic
    over CLAIMED-habitual is the typical shape). Equal rank → no lean."""
    ra, rb = _TAG_RANK.get(a.get("tag"), -1), _TAG_RANK.get(b.get("tag"), -1)
    if ra == rb:
        return None
    winner = a if ra > rb else b
    return {"favored_record": winner["id"], "reason": f"{winner['tag']} outranks the other (provisional F21)"}


async def _records(workspace_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """select c.id, c.kind, c.topic, c.tag, c.claim_text, c.session_id, c.speaker_id,
                  e.role as speaker_role, e.canonical_name as speaker_name
           from client_visible_claims c
           left join entities e on e.id = c.speaker_id
           where c.workspace_id = $1""",
        workspace_id,
    )
    return [dict(r) | {"id": str(r["id"])} for r in rows]


def _cross_source(a: dict, b: dict) -> bool:
    """A perception gap is EXEC-belief vs FLOOR-reality — it requires two DIFFERENT
    sources. Same-speaker records aren't a perception gap (at most a self-correction,
    which is a collision). This structural guard stops the comparator over-generating
    gaps within a single interview, regardless of prompt behavior."""
    sa, sb = a.get("speaker_id"), b.get("speaker_id")
    if sa is not None and sb is not None:
        return sa != sb
    # Fall back to session when speaker is unknown (scraped vs call is cross-source).
    return a.get("session_id") != b.get("session_id")


def _record_lines(records: list[dict]) -> str:
    out = []
    for r in records:
        who = r.get("speaker_role") or r.get("speaker_name") or "?"
        out.append(f"{r['id']} · {who} · {r['kind']}/{r['topic']}/{r['tag']} · {r['claim_text']}")
    return "\n".join(out)


async def _insert_conflict(pool, workspace_id, a_id, b_id, kind, resolution) -> bool:
    exists = await pool.fetchval(
        """select 1 from claim_conflicts where workspace_id = $1
           and ((claim_a_id = $2 and claim_b_id = $3) or (claim_a_id = $3 and claim_b_id = $2))""",
        workspace_id, a_id, b_id,
    )
    if exists or a_id == b_id:
        return False
    await pool.execute(
        """insert into claim_conflicts (workspace_id, claim_a_id, claim_b_id, kind, resolution)
           values ($1, $2, $3, $4, $5)""",
        workspace_id, a_id, b_id, kind, json.dumps(resolution),
    )
    return True


def _prompt_exists(agent_name: str, cfg: dict) -> bool:
    return (REPO_ROOT / cfg["prompt_path"]).exists()


async def detect_conflicts(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    records = await _records(workspace_id)
    if len(records) < 2:
        return
    by_id = {r["id"]: r for r in records}
    pool = await get_pool()
    lines = _record_lines(records)

    # ── Collision pass — any two records that can't both be true.
    cfg = await get_agent_config("collision_detector")
    if _prompt_exists("collision_detector", cfg):
        content = (
            "Records (client-visible only):\n" + lines +
            '\n\nReturn a JSON array of collisions, each: '
            '{"record_a":"id","record_b":"id","axis":"...","why":"...",'
            '"kind":"ceo-vs-floor|worker-vs-worker|now-vs-prior|call-vs-scrape"}. '
            "Empty array if none. Never invent collisions from vocabulary differences."
        )
        try:
            for c in extract_json(await run_agent("collision_detector", content, workspace_id=workspace_id)):
                a, b = by_id.get(c.get("record_a")), by_id.get(c.get("record_b"))
                if not a or not b:
                    continue
                await _insert_conflict(
                    pool, workspace_id, a["id"], b["id"],
                    _COLLISION_KIND.get(c.get("kind"), "now_vs_prior"),
                    {"axis": c.get("axis"), "why": c.get("why"), "lean": precedence_lean(a, b)},
                )
        except (ValueError, KeyError) as e:
            log.warning("collision pass failed: %s", e)

    # ── Perception-gap pass — leadership baseline vs operator lived account (F27).
    cfg = await get_agent_config("perception_gap")
    if _prompt_exists("perception_gap", cfg):
        content = (
            "Records (client-visible only):\n" + lines +
            '\n\nReturn a JSON array of perception gaps, each: '
            '{"baseline_record":"id (exec)","lived_record":"id (operator)","axis":"...",'
            '"gap":"leadership believes X; the floor is Y","magnitude":"coarse"}. '
            "Empty array if there is no operator counterpart to an exec baseline."
        )
        try:
            for g in extract_json(await run_agent("perception_gap", content, workspace_id=workspace_id)):
                a, b = by_id.get(g.get("baseline_record")), by_id.get(g.get("lived_record"))
                if not a or not b or not _cross_source(a, b):
                    continue  # a gap needs two different sources — never same-speaker
                await _insert_conflict(
                    pool, workspace_id, a["id"], b["id"], "perception_gap",
                    {"axis": g.get("axis"), "gap": g.get("gap"), "magnitude": g.get("magnitude"),
                     "render": "report-only", "lean": precedence_lean(a, b)},
                )
        except (ValueError, KeyError) as e:
            log.warning("perception-gap pass failed: %s", e)


@handles("detect_conflicts")
async def _detect_conflicts_job(payload: dict) -> None:
    await detect_conflicts(payload)
