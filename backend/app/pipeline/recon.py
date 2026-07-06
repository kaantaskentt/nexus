"""Stage 1 recon (Phase 2) — raw scrape → SCRAPED reference records + a client people
pool. Everything lands at SCRAPED, the bottom of the trust ladder; a scrape never
overrides a call and is never verified (non-negotiable #5, A2). Time-sensitive facts
carry a staleness flag so an out-of-date website can't embarrass the interview.

Live mode scrapes Firecrawl + Apify; demo mode takes fixtures (A11.3 — demo never
live-scrapes). People pool is client-side only and names+roles only (F4); a vendor or
agency contact can never enter the client entity registry."""

import json
import logging

from ..db import get_pool
from ..llm import extract_json, run_agent
from ..queue import handles
from ..scrape import apify_linkedin_people, firecrawl_scrape

log = logging.getLogger("nexus.recon")

_CONTRACT = (
    'Return ONE json object: {"company_records":[{"topic":"company-fact|tool|vocabulary",'
    '"claim":"third person","source_url":"","captured_at":"","quote":"verbatim","staleness_risk":"low|medium|high"}],'
    '"people_pool":[{"person":"full name","role_title":"as published","source_url":"",'
    '"side":"client|non-client","confidence":"high|low","aliases":[]}]}. '
    "Everything is SCRAPED. Flag time-sensitive facts (headcount, locations, launches) high. "
    "Only real client employees are side=client; agencies/vendors/journalists are non-client."
)
_TOPIC = {"company-fact": "company_fact", "company_fact": "company_fact",
          "tool": "tool", "vocabulary": "vocabulary"}


async def run_recon(payload: dict) -> None:
    workspace_id = payload["workspace_id"]
    pool = await get_pool()
    fixtures = payload.get("fixtures")

    # ── Gather raw material (fixtures for demo; live scrape otherwise) and record sources.
    website_md, people_raw = "", []
    if fixtures:
        website_md = fixtures.get("website_markdown", "")
        people_raw = fixtures.get("linkedin_people", [])
    else:
        if payload.get("website_url"):
            scraped = await firecrawl_scrape(payload["website_url"])
            website_md = (scraped or {}).get("markdown", "")
        lk = payload.get("linkedin") or {}
        if lk.get("actor_id"):
            people_raw = await apify_linkedin_people(lk["actor_id"], lk.get("input", {})) or []

    website_src = await pool.fetchval(
        "insert into scrape_sources (workspace_id, kind, url, content) values ($1,$2,$3,$4) returning id",
        workspace_id, "website" if not fixtures else "other", payload.get("website_url"),
        json.dumps({"markdown": website_md[:20000]}),
    )
    if people_raw:
        await pool.execute(
            "insert into scrape_sources (workspace_id, kind, content) values ($1,'linkedin_people',$2)",
            workspace_id, json.dumps(people_raw[:200]),
        )

    if not website_md and not people_raw:
        log.warning("recon: no material for workspace %s", workspace_id)
        return

    content = (
        f"WEBSITE (markdown):\n{website_md[:15000]}\n\n"
        f"LINKEDIN PEOPLE (raw):\n{json.dumps(people_raw[:60], ensure_ascii=False)[:6000]}\n\n{_CONTRACT}"
    )
    try:
        data = extract_json(await run_agent("stage1_recon", content, workspace_id=workspace_id))
    except ValueError as e:
        log.warning("recon structuring failed: %s", e)
        return

    # ── Company facts → SCRAPED claim records (never above SCRAPED).
    for rec in data.get("company_records", []):
        topic = _TOPIC.get((rec.get("topic") or "").lower(), "company_fact")
        await pool.execute(
            """insert into claim_records
                 (workspace_id, scrape_source_id, kind, topic, tag, claim_text, evidence_quote,
                  evidence_ts, provenance)
               values ($1,$2,'statement',$3,'SCRAPED',$4,$5,$6,$7)""",
            workspace_id, website_src, topic, rec.get("claim") or "", rec.get("quote"),
            rec.get("captured_at"),
            json.dumps({"source_url": rec.get("source_url"), "staleness_risk": rec.get("staleness_risk", "high")}),
        )

    # ── People pool → client-side entities only (F4: names + roles). Vendor/non-client
    # people are dropped — they can never enter the client registry.
    for person in data.get("people_pool", []):
        if person.get("side") != "client" or not person.get("person"):
            continue
        await pool.execute(
            """insert into entities (workspace_id, entity_type, canonical_name, role, aliases,
                 is_vendor_side, source)
               values ($1,'person',$2,$3,$4,false,'scraped')
               on conflict (workspace_id, entity_type, canonical_name) do nothing""",
            workspace_id, person["person"], person.get("role_title"),
            person.get("aliases") or [],
        )

    # Stage 1 → Stage 2: seed falsifiable heuristics from the fresh SCRAPED layer.
    from ..queue import enqueue

    await enqueue("generate_heuristics", {"workspace_id": workspace_id})


@handles("run_recon")
async def _run_recon_job(payload: dict) -> None:
    await run_recon(payload)
