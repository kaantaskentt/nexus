"""Agent runner — every LLM call goes through an agent_config row and writes an
agent_runs audit record. Grounded generations must pass non-empty retrieval_queries
or this module raises (Phase 0 #2 — fail loudly, never silently ungrounded)."""

import json
import re
import time

import anthropic

from .config import REPO_ROOT, get_brand, get_settings
from .db import get_pool

_client: anthropic.AsyncAnthropic | None = None


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
            json.dumps({"chars": len(text)}),
            json.dumps(retrieval_queries or []),
            usage_in,
            usage_out,
            int((time.monotonic() - started) * 1000),
            status,
            error,
        )


async def run_chat(
    agent_name: str,
    messages: list[dict],
    *,
    extra_system: str = "",
    workspace_id: str | None = None,
    session_id: str | None = None,
    industry_block: str | None = None,
    max_tokens: int = 2048,
) -> str:
    """Multi-turn variant for the interview turn engine: the prompt file is the
    system persona, `extra_system` carries the per-interview handoff package, and
    `messages` is the running conversation. Same audit trail as run_agent."""
    cfg = await get_agent_config(agent_name)
    system = load_prompt(cfg["prompt_path"], industry_block)
    if extra_system:
        system = f"{system}\n\n{extra_system}"
    started = time.monotonic()
    status, error, text = "ok", None, ""
    usage_in = usage_out = None
    try:
        resp = await client().messages.create(
            model=cfg["model"],
            max_tokens=max_tokens,
            system=system,
            messages=messages,
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
            json.dumps({"turns": len(messages)}),
            json.dumps({"chars": len(text)}),
            json.dumps([]),
            usage_in,
            usage_out,
            int((time.monotonic() - started) * 1000),
            status,
            error,
        )
