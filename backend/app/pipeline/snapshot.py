"""Company Snapshot renderer (Phase 3, A3) — synthesizes snapshot_cards from the
client-visible record store per completed round. Append-only: each render is a new
render_batch, never an edit (truth emerges from comparison, non-negotiable #1).

Deny-by-default: reads only client_visible_claims, so quarantined sentiment never
reaches a card. Perception gaps are NOT rendered here — they are report-only (F27);
conflict_point cards surface only non-gap collisions safe for the live snapshot.
Interview-sourced evidence is paraphrased in client views (F33)."""

import json
import logging

from ..db import get_pool
from ..llm import run_agent_json
from ..queue import handles

log = logging.getLogger("nexus.snapshot")

_CARD_CONF = {"high", "verified", "reported", "scraped"}
_CONTRACT = """
Return ONE json object: {"cards": [ ... ]}. Each card is one of these EXACT shapes.

learned (a thing now known, with its source):
{"card_type":"learned","confidence":"high|verified|reported|scraped","content":{
  "title":"short","body":"one-two sentences, paraphrased (no attributed employee quotes)",
  "source":"call|person|message|web|linkedin","evidence_claim_ids":["id"]}}

area_to_investigate (a pain/gap to dig into next):
{"card_type":"area_to_investigate","confidence":"high|verified|reported|scraped","content":{
  "rank":1,"title":"short","pain_band":"low|moderate|high|severe","owner":"name or null",
  "status":"Not yet investigated","admin_only":false,"why_ranked":"one line",
  "summary":"one line on the card face",
  "signals":{"frequency":"qualitative","emotional_weight":"qualitative","mentions":"qualitative"},
  "beliefs":[{"text":"a belief so far","confidence":"high|verified|reported|guess|scraped"}],
  "evidence_claim_ids":["id"],"what_we_dont_know":["open question"],
  "who_holds":{"name":"","role":"","why_line":"responsibility fact only","entity_id":"id or omit"}}}

suggested_person (who to interview next — responsibility facts only, F34):
{"card_type":"suggested_person","confidence":"high|verified|reported|scraped","content":{
  "name":"","role":"","why_line":"what they own (responsibility, not judgment)",
  "tag":{"label":"call-discovered","tone":"call"},"entity_id":"id or omit"}}

Rules: paraphrase interview evidence (never an attributed employee quote); why_lines carry
responsibility facts only, never a characterization; pain bands are coarse words, never
numbers; every card cites the claim ids it rests on. Do NOT emit perception-gap cards.
"""


async def render_snapshot(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    round_id = payload.get("round_id")
    pool = await get_pool()

    claims = await pool.fetch(
        """select c.id, c.kind, c.topic, c.tag, c.claim_text, c.evidence_quote, c.session_id,
                  p.band as pain_band, e.canonical_name as subject_name, e.role as subject_role
           from client_visible_claims c
           left join pain_scores p on p.claim_id = c.id
           left join entities e on e.id = c.subject_id
           where c.workspace_id = $1""",
        workspace_id,
    )
    if not claims:
        log.info("snapshot: no claims for %s", workspace_id)
        return
    people = await pool.fetch(
        "select canonical_name, role, id from entities where workspace_id=$1 and entity_type='person'",
        workspace_id,
    )
    lines = "\n".join(
        f"{c['id']} · {c['kind']}/{c['topic']}/{c['tag']}"
        + (f"/pain:{c['pain_band']}" if c["pain_band"] else "")
        + f" · {c['claim_text']}" for c in claims
    )
    ppl = "\n".join(f"{p['id']} · {p['canonical_name']} ({p['role'] or '?'})" for p in people)
    content = f"Client-visible records:\n{lines}\n\nKnown people:\n{ppl}\n\n{_CONTRACT}"

    data = await run_agent_json("snapshot_renderer", content, workspace_id=workspace_id)

    batch = (await pool.fetchval(
        "select coalesce(max(render_batch), 0) + 1 from snapshot_cards where workspace_id=$1",
        workspace_id)) or 1
    for card in data.get("cards", []):
        ctype = card.get("card_type")
        if ctype not in ("learned", "area_to_investigate", "suggested_person", "conflict_point"):
            continue
        conf = card.get("confidence")
        conf = conf if conf in _CARD_CONF else None
        await pool.execute(
            """insert into snapshot_cards (workspace_id, round_id, card_type, content, confidence, render_batch)
               values ($1,$2,$3,$4,$5,$6)""",
            workspace_id, round_id, ctype, json.dumps(card.get("content") or {}), conf, batch,
        )


@handles("render_snapshot")
async def _render_snapshot_job(payload: dict) -> None:
    await render_snapshot(payload)
