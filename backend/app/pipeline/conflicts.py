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
import re

from ..db import get_pool
from ..llm import get_agent_config, run_agent_json
from ..queue import handles
from ..config import REPO_ROOT

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


def _mark_self_retracted(recs: list[dict]) -> list[dict]:
    """Flag every claim that its OWN author later retracted (a same-speaker correction
    supersedes it). Such a claim is no longer that speaker's belief, so it must not seed a
    perception gap (packet §6 / #29). A CROSS-speaker supersede is left comparable — that
    divergence IS the gap material (tag precedence). Mutates and returns recs."""
    by_id = {r["id"]: r for r in recs}
    retracted: set[str] = set()
    for r in recs:
        sup = r.get("supersedes_id")
        if sup is None:
            continue
        old = by_id.get(str(sup))
        if old is not None and old.get("speaker_id") is not None and old["speaker_id"] == r.get("speaker_id"):
            retracted.add(str(sup))
    for r in recs:
        r["self_retracted"] = r["id"] in retracted
    return recs


async def _records(workspace_id: str) -> list[dict]:
    pool = await get_pool()
    rows = await pool.fetch(
        """select c.id, c.kind, c.topic, c.tag, c.claim_text, c.session_id, c.speaker_id,
                  c.supersedes_id, e.role as speaker_role, e.canonical_name as speaker_name
           from client_visible_claims c
           left join entities e on e.id = c.speaker_id
           where c.workspace_id = $1""",
        workspace_id,
    )
    return _mark_self_retracted([dict(r) | {"id": str(r["id"])} for r in rows])


_LEADERSHIP = re.compile(
    r"founder|ceo|owner|chief|exec|director|head|president|partner|leadership|principal", re.I)


def _is_leadership(rec: dict) -> bool:
    role = rec.get("speaker_role") or ""
    return bool(_LEADERSHIP.search(role))


def _valid_perception_gap(a: dict, b: dict) -> bool:
    """A perception gap is LEADERSHIP-belief vs FLOOR-reality. Two structural
    requirements the prompt can't be trusted to hold alone (prompts-evals §7 finding):
      1. different speakers — same-speaker general-vs-episodic is a self-hedge/correction,
         never a gap;
      2. EXACTLY ONE side is leadership-sourced — two operators disagreeing is a
         worker-vs-worker COLLISION, not a perception gap, and a single-operator
         interview (no leadership record) yields zero gaps.
    Fabricating a 'leadership believes…' framing from an operator's own words is the
    exact confident fiction this guard prevents.

    #29 (packet §6): a claim its OWN author retracted (a same-speaker correction supersedes
    it) is no longer that speaker's belief, so it can seed no gap on either side. A claim
    superseded CROSS-speaker is kept — that divergence is the gap material."""
    if a.get("self_retracted") or b.get("self_retracted"):
        return False
    sa, sb = a.get("speaker_id"), b.get("speaker_id")
    if sa is not None and sb is not None and sa == sb:
        return False
    return _is_leadership(a) != _is_leadership(b)


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
        for c in await run_agent_json("collision_detector", content, workspace_id=workspace_id):
            a, b = by_id.get(c.get("record_a")), by_id.get(c.get("record_b"))
            if not a or not b:
                continue
            await _insert_conflict(
                pool, workspace_id, a["id"], b["id"],
                _COLLISION_KIND.get(c.get("kind"), "now_vs_prior"),
                {"axis": c.get("axis"), "why": c.get("why"), "lean": precedence_lean(a, b)},
            )

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
        for g in await run_agent_json("perception_gap", content, workspace_id=workspace_id):
            a, b = by_id.get(g.get("baseline_record")), by_id.get(g.get("lived_record"))
            if not a or not b or not _valid_perception_gap(a, b):
                continue  # gap needs a leadership baseline vs a different-speaker floor account
            await _insert_conflict(
                pool, workspace_id, a["id"], b["id"], "perception_gap",
                {"axis": g.get("axis"), "gap": g.get("gap"), "magnitude": g.get("magnitude"),
                 "render": "report-only", "lean": precedence_lean(a, b)},
            )


@handles("detect_conflicts")
async def _detect_conflicts_job(payload: dict) -> None:
    await detect_conflicts(payload)
