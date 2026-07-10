"""Agent runner — every LLM call goes through an agent_config row and writes an
agent_runs audit record. Grounded generations must pass non-empty retrieval_queries
or this module raises (Phase 0 #2 — fail loudly, never silently ungrounded)."""

import json
import logging
import re
import time

import anthropic

from .config import REPO_ROOT, get_brand, get_settings
from .db import get_pool

log = logging.getLogger("nexus.llm")

_client: anthropic.AsyncAnthropic | None = None


class AgentParseError(RuntimeError):
    """An agent produced output that couldn't be parsed as JSON. Raised (not swallowed)
    so the owning job fails and retries instead of silently dropping the result (#22).
    The raw output is on the agent_runs audit row (output_ref.text) for debugging.
    Deliberately NOT a ValueError, so a stray `except ValueError` can't re-swallow it."""


def extract_json(text: str):
    """Tolerant JSON extraction shared by pipeline agents — the model may wrap the
    object/array in prose or a ```json fence. Returns the parsed value."""
    m = re.search(r"```(?:json)?\s*([\[{].*[\]}])\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    # Pick the container by whichever bracket opens first, so a top-level array isn't
    # mistaken for its inner object.
    candidates = [(text.find(o), o, c) for o, c in (("{", "}"), ("[", "]")) if text.find(o) != -1]
    for _, open_c, close_c in sorted(candidates):
        start, end = text.find(open_c), text.rfind(close_c)
        if end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("no JSON found in agent output")


def client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    return _client


async def get_agent_config(agent_name: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow("select * from agent_configs where agent_name = $1", agent_name)
    if row is None:
        raise RuntimeError(f"no agent_config for {agent_name!r} — seed it in the DB")
    return dict(row)


def load_prompt(prompt_path: str, industry_block: str | None = None) -> str:
    """Prompts stay domain-neutral; industry calibration is runtime-injected (A14).
    Brand is config (A13.2): {{PRODUCT_NAME}} resolves from config/brand.json so a
    rename is a one-line change, never a prompt edit."""
    prompt = (REPO_ROOT / prompt_path).read_text()
    prompt = prompt.replace("{{INDUSTRY_CALIBRATION}}", industry_block or "")
    prompt = prompt.replace("{{PRODUCT_NAME}}", get_brand()["product_name"])
    return prompt


async def run_agent(
    agent_name: str,
    user_content: str,
    *,
    workspace_id: str | None = None,
    session_id: str | None = None,
    industry_block: str | None = None,
    retrieval_queries: list[str] | None = None,
    claims_grounding: bool = False,
    max_tokens: int = 8192,
) -> str:
    if claims_grounding and not retrieval_queries:
        raise RuntimeError(
            f"{agent_name} claims KB grounding but retrieval_queries is empty (Phase 0 #2)"
        )
    cfg = await get_agent_config(agent_name)
    system = load_prompt(cfg["prompt_path"], industry_block)
    started = time.monotonic()
    status, error, text = "ok", None, ""
    usage_in = usage_out = None
    try:
        resp = await client().messages.create(
            model=cfg["model"],
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        usage_in, usage_out = resp.usage.input_tokens, resp.usage.output_tokens
        return text
    except Exception as e:
        status, error = "error", str(e)
        raise
    finally:
        pool = await get_pool()
        await pool.execute(
            """insert into agent_runs (agent_name, model, prompt_version, workspace_id,
                   session_id, input_ref, output_ref, retrieval_queries,
                   input_tokens, output_tokens, latency_ms, status, error)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
            agent_name,
            cfg["model"],
            cfg["prompt_version"],
            workspace_id,
            session_id,
            json.dumps({"chars": len(user_content)}),
            # Persist the raw output, not just its length, so a parse failure downstream
            # is debuggable from the audit row instead of unrecoverable (#22).
            json.dumps({"chars": len(text), "text": text}),
            json.dumps(retrieval_queries or []),
            usage_in,
            usage_out,
            int((time.monotonic() - started) * 1000),
            status,
            error,
        )


async def run_agent_json(agent_name: str, user_content: str, **kwargs):
    """run_agent + strict JSON parse. On parse failure, log at ERROR and raise
    AgentParseError so the owning job fails and retries — never a silent drop that
    leaves the job 'done' with no output written (#22). The raw output is on the
    agent_runs audit row (output_ref.text)."""
    text = await run_agent(agent_name, user_content, **kwargs)
    try:
        return extract_json(text)
    except ValueError as e:
        log.error(
            "agent %r produced unparseable JSON (%d chars) — job will fail/retry: %s",
            agent_name, len(text), e,
        )
        raise AgentParseError(f"{agent_name} output not parseable as JSON: {e}") from e


def cache_block(text: str) -> dict:
    """A system text block marked as a prompt-cache breakpoint (ephemeral, 5m default).
    Everything up to and including this block is cached, so the next turn within the TTL
    pays uncached only for the delta after it. Used by the interview turn engine, where
    the persona + handoff package are identical turn-to-turn (SIMPLIFY-EF-FINDINGS E/F —
    ~8k stable input tokens were being reprocessed every turn)."""
    return {"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}


async def run_chat(
    agent_name: str,
    messages: list[dict],
    *,
    extra_system: str = "",
    volatile_system: str = "",
    cache: bool = False,
    workspace_id: str | None = None,
    session_id: str | None = None,
    industry_block: str | None = None,
    max_tokens: int = 2048,
) -> str:
    """Multi-turn variant for the interview turn engine: the prompt file is the system
    persona, `extra_system` carries the STABLE per-interview handoff package, and
    `messages` is the running conversation. `volatile_system` carries the per-turn bits
    (elapsed time, coverage, fade nudge) that change every turn.

    When `cache=True`, the persona + `extra_system` become a single cached prompt-prefix
    block and `volatile_system` follows as an uncached block. The model sees byte-identical
    system text either way (blocks concatenate); the split only lets the stable prefix be
    served from cache. Same audit trail as run_agent, plus cache token counts."""
    cfg = await get_agent_config(agent_name)
    persona = load_prompt(cfg["prompt_path"], industry_block)
    stable = f"{persona}\n\n{extra_system}" if extra_system else persona
    if cache:
        system: str | list = [cache_block(stable)]
        if volatile_system:
            # Leading "\n\n" keeps the concatenation identical to the uncached string.
            system.append({"type": "text", "text": f"\n\n{volatile_system}"})
    else:
        system = f"{stable}\n\n{volatile_system}" if volatile_system else stable
    started = time.monotonic()
    status, error, text = "ok", None, ""
    usage_in = usage_out = cache_read = cache_write = None
    try:
        resp = await client().messages.create(
            model=cfg["model"],
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        usage_in, usage_out = resp.usage.input_tokens, resp.usage.output_tokens
        cache_read = getattr(resp.usage, "cache_read_input_tokens", None)
        cache_write = getattr(resp.usage, "cache_creation_input_tokens", None)
        return text
    except Exception as e:
        status, error = "error", str(e)
        raise
    finally:
        pool = await get_pool()
        await pool.execute(
            """insert into agent_runs (agent_name, model, prompt_version, workspace_id,
                   session_id, input_ref, output_ref, retrieval_queries,
                   input_tokens, output_tokens, latency_ms, status, error)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)""",
            agent_name,
            cfg["model"],
            cfg["prompt_version"],
            workspace_id,
            session_id,
            # cache_read/write on the audit row so a warm-cache hit is visible in prod.
            json.dumps({"turns": len(messages), "cache_read": cache_read, "cache_write": cache_write}),
            json.dumps({"chars": len(text)}),
            json.dumps([]),
            usage_in,
            usage_out,
            int((time.monotonic() - started) * 1000),
            status,
            error,
        )
