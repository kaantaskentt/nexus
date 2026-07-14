"""Deep Research Knowledge Base — post-snapshot operational research pass.

Sources: docs/PRD-DEEP-RESEARCH-KB.md §5 (trigger, tool, model seat), §5b (Definition
of Done), §5c (chunking discipline + mandatory source citation), §6 (data model), §7
(retrieval), §9 (fallback-eligibility gate).

This module is deliberately NOT part of the claim ontology: no trust tag, never a
claim_records row, never client-visible evidence. It generates reference knowledge
about a KIND of business (an industry/model/scale bucket — a "case"), never a fact
about the specific workspace that triggered it — the same "territory, never the
company" discipline `role-schema.md` already applies to its 180-word prime, extended
here to a whole researched case with real web citations.

Fail-open: any failure here must never affect the snapshot or anything enqueued
alongside it (embeddings.py's discipline — "a missing/failing embedding API must never
block a compile" — applies the same way to a missing/failing deep-research pass).

v1 scope note: workspaces only carry a free-text `industry` column today, so the case
fingerprint is industry-only for now (`business_model` / `scale_band` stay None). The
schema and prompt already carry both dimensions so a future snapshot-derived business-
model/scale signal is a data change, not a schema change.
"""

import json
import logging
import time

from ..db import get_pool
from ..embeddings import embed, to_pgvector
from ..llm import AgentParseError, client, extract_json, get_agent_config, load_prompt
from ..queue import handles

log = logging.getLogger("nexus.deep_research")

# §5b — must-hit sections and their minimum accepted-finding count.
MUST_HIT = {
    "process_areas": 2,
    "tools_systems": 2,
    "roles_org": 1,
    "failure_modes": 2,
    "definition_of_done": 1,
}
NICE_TO_HAVE = {"kpis_benchmarks", "vocabulary", "seasonality", "compliance"}
ALL_SECTIONS = {**MUST_HIT, **{s: 0 for s in NICE_TO_HAVE}}
# §5c — a ceiling on the schema, not a suggestion: forces selection over exhaustiveness.
SECTION_CAP = {**{s: 6 for s in MUST_HIT}, **{s: 4 for s in NICE_TO_HAVE}}
MIN_BODY_CHARS = 40  # coarse filler guard (§5b #3) — the real selectivity bar is the prompt
MAX_GENERATION_ATTEMPTS = 2  # §5b rerun-once policy
MAX_PAUSE_RESUMES = 3  # server-tool loop can pause_turn; cap resumes so cost stays bounded
DEFAULT_MAX_SEARCH_USES = 6
DEFAULT_MAX_FETCH_USES = 4


def _fingerprint(industry: str, business_model: str | None, scale_band: str | None) -> str:
    return "|".join([
        (industry or "").strip().lower(),
        (business_model or "").strip().lower(),
        (scale_band or "").strip().lower(),
    ])


async def build_research_brief(pool, workspace_id: str) -> dict:
    """The only company-specific context the research agent's SCOPE draws from — used to
    pick what to research, never emitted in the output (mirrors role-schema.md: the agent
    itself never sees this brief, only the resolved industry/model/scale — see
    run_deep_research). Reads only non-quarantined, client-visible learned cards."""
    cards = await pool.fetch(
        """select content from snapshot_cards
           where workspace_id = $1 and card_type = 'learned'
           order by render_batch desc, created_at desc limit 20""",
        workspace_id,
    )
    facts = []
    for row in cards:
        content = row["content"]
        if isinstance(content, str):
            content = json.loads(content)
        title, body = content.get("title"), content.get("body")
        if title or body:
            facts.append(f"{title}: {body}" if title and body else (title or body))
    return {"company_facts": facts[:15]}


def _extract_urls(block) -> set[str]:
    """Walk a tool-result content block for every 'url' field it carries, regardless of
    the exact nested shape — defensive against SDK response-shape drift (§5c needs this
    to cross-check a finding's source_url against what was actually fetched)."""
    try:
        data = block.model_dump()
    except AttributeError:
        data = block if isinstance(block, dict) else {}
    urls: set[str] = set()

    def walk(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k == "url" and isinstance(v, str):
                    urls.add(v)
                else:
                    walk(v)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return urls


def _url_is_grounded(source_url: str, urls_seen: set[str]) -> bool:
    """A finding's cited URL must correspond to something the agent actually retrieved
    this run (§5c) — tolerant of trailing-slash/query-string drift between what a tool
    result reports and what the model echoes back, but never accepts a URL with no
    relationship at all to anything seen."""
    norm = source_url.rstrip("/")
    return any(norm == seen or norm in seen or seen in norm
               for seen in (u.rstrip("/") for u in urls_seen))


async def _run_research_agent(
    workspace_id: str, industry: str, business_model: str | None, scale_band: str | None,
) -> tuple[list[dict], set[str], bool]:
    """Calls the deep_research_analyst seat with web_search + web_fetch as server-side
    tools. Not routed through llm.run_agent — that helper has no tool-use path, and this
    is the one seat in the codebase that needs one. Writes its own agent_runs audit row
    in the same shape run_agent uses, so it shows up in the same audit trail."""
    cfg = await get_agent_config("deep_research_analyst")
    system = load_prompt(cfg["prompt_path"])
    user_content = (
        f"Industry / kind of business: {industry}\n"
        f"Business model: {business_model or 'unknown'}\n"
        f"Scale: {scale_band or 'unknown'}\n\n"
        "Research this vertical now and return the findings JSON."
    )
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": DEFAULT_MAX_SEARCH_USES},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": DEFAULT_MAX_FETCH_USES},
    ]
    messages = [{"role": "user", "content": user_content}]
    started = time.monotonic()
    status, error = "ok", None
    urls_seen: set[str] = set()
    any_tool_used = False
    text = ""
    usage_in = usage_out = 0
    resp = None
    try:
        for _ in range(MAX_PAUSE_RESUMES + 1):
            resp = await client().messages.create(
                model=cfg["model"], max_tokens=8192, system=system, tools=tools, messages=messages,
            )
            usage_in += resp.usage.input_tokens
            usage_out += resp.usage.output_tokens
            for block in resp.content:
                btype = getattr(block, "type", None)
                if btype == "server_tool_use":
                    any_tool_used = True
                elif btype in ("web_search_tool_result", "web_fetch_tool_result"):
                    any_tool_used = True
                    urls_seen |= _extract_urls(block)
                elif btype == "text":
                    text += block.text
            if resp.stop_reason != "pause_turn":
                break
            messages = [
                {"role": "user", "content": user_content},
                {"role": "assistant", "content": resp.content},
            ]
        else:
            log.warning("deep_research: hit max pause_turn resumes for workspace %s", workspace_id)
    except Exception as e:
        status, error = "error", str(e)
        raise
    finally:
        pool = await get_pool()
        await pool.execute(
            """insert into agent_runs (agent_name, model, prompt_version, workspace_id,
                   input_ref, output_ref, retrieval_queries, input_tokens, output_tokens,
                   latency_ms, status, error)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
            "deep_research_analyst",
            cfg["model"],
            cfg["prompt_version"],
            workspace_id,
            json.dumps({"industry": industry, "business_model": business_model, "scale_band": scale_band}),
            json.dumps({"chars": len(text), "text": text, "urls_seen": sorted(urls_seen)}),
            json.dumps([]),
            usage_in,
            usage_out,
            int((time.monotonic() - started) * 1000),
            status,
            error,
        )
    try:
        data = extract_json(text)
    except ValueError as e:
        log.error("deep_research_analyst produced unparseable JSON (%d chars): %s", len(text), e)
        raise AgentParseError(f"deep_research_analyst output not parseable as JSON: {e}") from e
    return data.get("findings", []), urls_seen, any_tool_used


def _evaluate_dod(
    findings: list[dict], urls_seen: set[str], any_tool_used: bool,
) -> tuple[bool, list[dict]]:
    """§5b, enforced in code, never assumed from the agent's own say-so. Returns
    (dod_met, accepted) — accepted is already filtered for source-url validity, grounding,
    minimum body length, and per-section caps; dod_met reflects the FILTERED set."""
    accepted: list[dict] = []
    counts = {s: 0 for s in ALL_SECTIONS}
    for f in findings:
        section = f.get("section")
        body = (f.get("body") or "").strip()
        source_url = (f.get("source_url") or "").strip()
        if section not in ALL_SECTIONS or len(body) < MIN_BODY_CHARS or not source_url:
            continue
        if not _url_is_grounded(source_url, urls_seen):
            log.info("deep_research: dropped finding — source_url not corroborated by tool results: %.100s", source_url)
            continue
        if counts[section] >= SECTION_CAP[section]:
            continue
        counts[section] += 1
        accepted.append({**f, "body": body, "source_url": source_url})
    dod_met = any_tool_used and all(counts[s] >= m for s, m in MUST_HIT.items())
    return dod_met, accepted


async def _link_workspace(pool, workspace_id: str, case_id) -> None:
    await pool.execute(
        """insert into workspace_research_links (workspace_id, case_id, relation)
           values ($1, $2, 'own') on conflict (workspace_id, case_id) do nothing""",
        workspace_id, case_id,
    )


async def run_deep_research(workspace_id: str) -> dict:
    """Entry point. Resolves/creates a case by fingerprint, runs the research agent only
    when needed (never re-researches an already-dod_met case — the whole point of cases
    is compounding, PRD §3), evaluates the DoD, stores accepted findings, links the
    workspace, and returns a small summary dict (used by the smoke test and, later, the
    job handler's log line)."""
    pool = await get_pool()
    ws = await pool.fetchrow("select industry, is_demo from workspaces where id = $1", workspace_id)
    if ws is None:
        raise RuntimeError(f"deep_research: no workspace {workspace_id}")
    industry = ws["industry"] or "unknown"
    is_demo = ws["is_demo"]
    business_model, scale_band = None, None  # v1 scope note (module docstring)
    fingerprint = _fingerprint(industry, business_model, scale_band)

    existing = await pool.fetchrow(
        "select * from research_cases where fingerprint = $1 and is_demo = $2",
        fingerprint, is_demo,
    )
    if existing and existing["dod_met"]:
        await _link_workspace(pool, workspace_id, existing["id"])
        return {"case_id": str(existing["id"]), "reused": True, "dod_met": True, "findings": None}

    if existing and existing["generation_attempts"] >= MAX_GENERATION_ATTEMPTS:
        await _link_workspace(pool, workspace_id, existing["id"])
        log.warning(
            "deep_research: case %s never met DoD after %d attempts — leaving for admin review",
            existing["id"], existing["generation_attempts"],
        )
        return {"case_id": str(existing["id"]), "reused": True, "dod_met": False, "findings": None}

    await build_research_brief(pool, workspace_id)  # scopes future refinement; unused in v1 query
    findings, urls_seen, any_tool_used = await _run_research_agent(
        workspace_id, industry, business_model, scale_band,
    )
    dod_met, accepted = _evaluate_dod(findings, urls_seen, any_tool_used)

    if existing:
        case_id = existing["id"]
        await pool.execute(
            "update research_cases set dod_met=$2, generation_attempts=$3, updated_at=now() where id=$1",
            case_id, dod_met, existing["generation_attempts"] + 1,
        )
        await pool.execute("delete from research_findings where case_id = $1", case_id)
    else:
        title = f"{industry.title()} — {business_model or 'general'} ({scale_band or 'unspecified scale'})"
        case_id = await pool.fetchval(
            """insert into research_cases
                 (industry, business_model, scale_band, fingerprint, title, status, dod_met,
                  generation_attempts, origin_workspace_id, is_demo)
               values ($1,$2,$3,$4,$5,'draft',$6,1,$7,$8) returning id""",
            industry, business_model, scale_band, fingerprint, title, dod_met, workspace_id, is_demo,
        )

    for f in accepted:
        emb = to_pgvector(await embed(f["body"]))
        await pool.execute(
            """insert into research_findings (case_id, section, title, body, source_url, embedding)
               values ($1,$2,$3,$4,$5,$6)""",
            case_id, f["section"], f.get("title"), f["body"], f["source_url"], emb,
        )

    await _link_workspace(pool, workspace_id, case_id)
    return {"case_id": str(case_id), "reused": False, "dod_met": dod_met, "findings": len(accepted)}


@handles("deep_research")
async def _deep_research_job(payload: dict) -> None:
    await run_deep_research(payload["workspace_id"])
