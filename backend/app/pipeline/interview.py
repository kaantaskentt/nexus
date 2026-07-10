"""Interview turn engine — transport-agnostic. Text chat calls run_interview_turn;
voice (Phase 5) streams via stream_interview_turn behind the VAPI custom-LLM endpoint.
Either way the same rules hold:

- The interviewer's whole world is the handoff package (built by handoff.py). It never
  sees claim text or a quarantined record — nothing anyone else said reaches this person.
- Utterances are stored VERBATIM both directions (hedges are data; cleanup destroys the
  product). The transcript this produces is what the Stage 4 compiler later consumes.
- Coverage + elapsed live in the session's resumable_state so the same invite link
  resumes exactly where it stopped (A5)."""

import json
from datetime import datetime, timezone

from ..config import REPO_ROOT, get_settings
from ..db import get_pool
from ..llm import cache_block, client, get_agent_config, load_prompt, run_chat, run_chat_stream
from ..queue import handles
from . import attention, coverage, handoff
from .live_capture import enqueue_extraction

PAUSE_OFFER_MINUTES = 20
_START_NUDGE = "(The respondent has joined and is ready to begin.)"


def _industry_block(industry: str | None) -> str | None:
    if not industry:
        return None
    path = REPO_ROOT / "prompts" / "examples" / f"{industry}.md"
    return path.read_text() if path.exists() else None


async def _load_package(plan_id) -> dict:
    """The handoff package for this session's plan — built on demand if the plan was
    approved without one yet. No plan (e.g. a smoke session) → an empty package."""
    if plan_id is None:
        return {}
    pool = await get_pool()
    row = await pool.fetchrow("select package from handoff_packages where plan_id = $1", plan_id)
    if row is None:
        return await handoff.build_handoff_package(str(plan_id))
    return json.loads(row["package"]) if isinstance(row["package"], str) else row["package"]


def _package_objectives(package: dict) -> list:
    """Objectives live under `objectives` in a real handoff (handoff.py) but under `topics`
    in the eval-bootstrap handoff shape — accept either so coverage runs on both paths."""
    return package.get("objectives") or package.get("topics") or []


def _messages_from(utterances: list[dict]) -> list[dict]:
    # Anthropic needs the conversation to start with a user turn; the first real
    # utterance is the agent's opening, so prepend a synthetic (unstored) nudge.
    msgs = [{"role": "user", "content": _START_NUDGE}]
    for u in utterances:
        role = "assistant" if u["speaker"] == "agent" else "user"
        msgs.append({"role": role, "content": u["text"]})
    return msgs


async def _next_index(session_id: str) -> int:
    pool = await get_pool()
    return await pool.fetchval(
        "select coalesce(max(turn_index), -1) + 1 from utterances where session_id = $1",
        session_id,
    )


def _context_call_block(session, elapsed_min: float) -> str:
    """Runtime block for the F7 context call: the collector's objectives live in its own
    persona (the Stage-3 exit-condition table), so the per-session context is just who
    the client is and how long the call has run. ~30 min is the stage-3 soft budget."""
    return (
        "## This context call (BETA)\n"
        f"You are running the Stage-3 context call with the client. "
        f"Company: {session['workspace_name']}. "
        f"Runtime status: about {int(elapsed_min)} minute(s) elapsed of a roughly "
        "30 minute call. The exit-condition table in your instructions is your whole "
        "objective set."
    )


def _session_scenario(session) -> dict | None:
    """SIMPLIFY I: a roleplay session minted from a workflow carries {label, objectives} in
    resumable_state.scenario. Returns it only for roleplay sessions (the interviewer probes
    that workflow); every other kind is None and takes its normal path."""
    if session["session_kind"] != "roleplay":
        return None
    state = session["resumable_state"]
    state = json.loads(state) if isinstance(state, str) else (state or {})
    sc = state.get("scenario")
    return sc if isinstance(sc, dict) and sc.get("objectives") else None


def _scenario_block(scenario: dict) -> str:
    """The interviewer's steer for a simulation: probe THIS workflow, cover these objectives.
    Frames like a handoff's objectives — the agent interviews for real, never told it's a
    drill (that would change the very behavior the simulation tests)."""
    label = scenario.get("label") or "this workflow"
    objectives = scenario.get("objectives") or []
    lines = "\n".join(f"- {o}" for o in objectives)
    return (
        "## Your focus for this interview\n"
        f'Draw out how "{label}" really happens, end to end, in the respondent\'s own words. '
        "Cover these objectives before you close:\n"
        f"{lines}\n\n"
        "Hunt for concrete episodes, surface the exceptions and what breaks it, and do not "
        "accept a tidy summary. You were never told what anyone else said."
    )


async def _prepare_turn(session_id: str, respondent_text: str | None):
    """Shared setup for both the streaming and non-streaming turn paths: validate the
    session, store the respondent's verbatim turn, and assemble the model context."""
    pool = await get_pool()
    session = await pool.fetchrow(
        "select s.*, w.industry, w.name as workspace_name from interview_sessions s "
        "join workspaces w on w.id = s.workspace_id where s.id = $1",
        session_id,
    )
    if session is None:
        raise RuntimeError(f"interview turn: no session {session_id}")
    if session["status"] in ("completed", "expired"):
        raise RuntimeError(f"session {session_id} is {session['status']}")

    started_at = session["started_at"] or datetime.now(timezone.utc)
    respondent_turn_index = None
    if respondent_text is not None:
        respondent_turn_index = await _next_index(session_id)
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,'respondent',$3)",
            session_id, respondent_turn_index, respondent_text,
        )
    utterances = [
        dict(r) for r in await pool.fetch(
            "select turn_index, speaker, text from utterances where session_id = $1 order by turn_index",
            session_id,
        )
    ]
    package = await _load_package(session["plan_id"])
    elapsed_min = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
    # F7 BETA: a 'context' session is the Stage-3 CEO call run by the context-collector
    # persona. It has no plan handoff — the persona carries the exit-condition table —
    # so it gets a runtime block instead of the interviewer's package block. Every other
    # kind takes the exact path it always did.
    # Split the system into a STABLE prefix (cached prompt-prefix) and a VOLATILE tail
    # (changes every turn, never cached). The persona + handoff package are identical
    # turn-to-turn — caching them stops ~8k input tokens being reprocessed each turn
    # (SIMPLIFY-EF-FINDINGS E). The model still sees byte-identical system text: the two
    # blocks concatenate exactly as the old single string did.
    is_context_call = session["session_kind"] == "context"
    scenario = _session_scenario(session)  # SIMPLIFY I: a roleplay session bound to a workflow
    if is_context_call:
        # No plan handoff (the persona carries the exit table). The context block holds the
        # elapsed clock, so it IS the volatile part; there's no stable package prefix here.
        stable_extra = ""
        volatile_extra = _context_call_block(session, elapsed_min)
    elif scenario:
        # Simulation: the interviewer probes THIS workflow with the derived objectives (its
        # stable steer, cacheable). It interviews for real — nothing tells it this is a drill;
        # the SIMULATION marker lives on the human player's screen, not in the agent's prompt.
        stable_extra = _scenario_block(scenario)
        volatile_extra = (
            f"Runtime status: about {int(elapsed_min)} minute(s) elapsed."
        )
    else:
        stable_extra = (
            "## Your handoff package for this interview\n"
            "This package is your whole world — objectives, questions, vocabulary, handling "
            "notes, and the NEVER list. You were never told what anyone else said.\n\n"
            f"```json\n{json.dumps(package, ensure_ascii=False, indent=2)}\n```"
        )
        volatile_extra = (
            f"Runtime status: about {int(elapsed_min)} minute(s) elapsed. Time budget "
            f"{package.get('time_budget_minutes', 30)} minutes."
        )

    # Computed coverage (V3): audit the objectives against the transcript server-side and
    # hand the interviewer an authoritative satisfied/partial/untouched map, so a must-hit
    # the respondent never volunteers can't quietly go untouched to close. Fail-open — a
    # None map just leaves the persona's own (model-side) coverage in charge. Default OFF
    # (config.coverage_routing): the A/B showed the persona already covers explicit
    # must-hit objectives at baseline, so this per-turn classifier is dormant until an
    # eval justifies its latency (see config comment + proof-matrix.md). Per-turn, so it
    # rides the VOLATILE block — never the cached prefix.
    cov = None
    if get_settings().coverage_routing:
        cov = await coverage.compute_coverage(
            _package_objectives(package),
            utterances,
            workspace_id=str(session["workspace_id"]),
            session_id=session_id,
        )
        cov_block = coverage.build_coverage_block(cov)
        if cov_block:
            volatile_extra = f"{volatile_extra}\n\n{cov_block}"

    # Tea-break v1 (A26): fade-triggered pause offer. Deterministic signals, injected
    # ONCE per session — pause_offered is the shared once-max flag with the 20-minute
    # offer, so the respondent never gets asked twice by two different mechanisms.
    prior_state = session["resumable_state"]
    prior_state = json.loads(prior_state) if isinstance(prior_state, str) else (prior_state or {})
    fade = None
    if not prior_state.get("pause_offered"):
        fade = attention.detect_fade(utterances)
        if fade:
            budget = package.get("time_budget_minutes", 30)
            volatile_extra = (
                f"{volatile_extra}\n\n"
                + attention.build_fade_nudge(fade["signals"], elapsed_min, budget)
            )

    return {
        "session": session,
        "persona": "context_collector" if is_context_call else "interviewer",
        "messages": _messages_from(utterances),
        "extra_system": stable_extra,
        "volatile_system": volatile_extra,
        "started_at": started_at,
        "elapsed_min": elapsed_min,
        "package": package,
        "coverage": cov,
        "fade_offered": bool(fade),
        "respondent_turn_index": respondent_turn_index,
    }


async def _finalize_turn(ctx: dict, reply: str) -> dict:
    """Store the agent's verbatim reply and advance resumable_state. Shared by both paths."""
    pool = await get_pool()
    session = ctx["session"]
    session_id = str(session["id"])
    elapsed_min = ctx["elapsed_min"]

    agent_index = await _next_index(session_id)
    await pool.execute(
        "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,'agent',$3)",
        session_id, agent_index, reply,
    )
    prior = session["resumable_state"]
    prior = json.loads(prior) if isinstance(prior, str) else (prior or {})
    should_offer_pause = elapsed_min >= PAUSE_OFFER_MINUTES and not prior.get("pause_offered")
    # A fade-triggered offer consumes the same once-max budget as the clock offer.
    if ctx.get("fade_offered"):
        should_offer_pause = True
    new_state = {
        **prior,
        "turn_count": prior.get("turn_count", 0) + 1,
        "elapsed_minutes": round(elapsed_min, 1),
        "objectives": _package_objectives(ctx["package"]),
        # Computed coverage map (satisfied/partial/untouched per objective) as of this
        # turn — the engine-side replacement for the old static objectives echo. None when
        # the auditor failed (fail-open) or there were no objectives; consumed by the next
        # turn's routing gate and available to the report/UI.
        "coverage": ctx.get("coverage"),
        "pause_offered": prior.get("pause_offered", False) or should_offer_pause,
        "last_turn_at": datetime.now(timezone.utc).isoformat(),
    }
    await pool.execute(
        """update interview_sessions
           set status = case when status in ('pending', 'paused') then 'active' else status end,
               started_at = coalesce(started_at, $2),
               resumable_state = $3
           where id = $1""",
        session_id, ctx["started_at"], json.dumps(new_state),
    )
    # SIMPLIFY E: fire the live-capture extractor off the just-committed RESPONDENT turn
    # (the delta). Fire-and-forget display data — gated to real interview/context kinds so
    # eval/voice_test/roleplay never spawn it. Never in the request's critical path.
    resp_idx = ctx.get("respondent_turn_index")
    if resp_idx is not None and session["session_kind"] in ("interview", "context"):
        await enqueue_extraction(session_id, resp_idx)
    return {
        "reply": reply,
        "turn_index": agent_index,
        "elapsed_minutes": round(elapsed_min, 1),
        "should_offer_pause": should_offer_pause,
    }


async def run_interview_turn(session_id: str, respondent_text: str | None = None) -> dict:
    ctx = await _prepare_turn(session_id, respondent_text)
    reply = await run_chat(
        ctx["persona"],
        ctx["messages"],
        extra_system=ctx["extra_system"],
        volatile_system=ctx["volatile_system"],
        cache=True,
        workspace_id=str(ctx["session"]["workspace_id"]),
        session_id=session_id,
        industry_block=_industry_block(ctx["session"]["industry"]),
    )
    return await _finalize_turn(ctx, reply)


async def stream_interview_turn(session_id: str, respondent_text: str | None = None):
    """Streaming text turn (SIMPLIFY E): the same engine as run_interview_turn, but the
    reply streams token-by-token so perceived latency drops to first-token instead of
    3-7s of typing dots. Same contract otherwise — _prepare_turn stores the respondent's
    verbatim turn, _finalize_turn persists the assembled reply and advances resumable_state
    (and fires live capture), so a stream and a non-stream turn are indistinguishable in the
    record. Yields {'type':'delta','text':...} per token, then one {'type':'done', ...} with
    the same fields the non-streaming endpoint returns. If the stream errors mid-flight the
    reply is NOT finalized (no half-turn is stored) and the exception propagates to the
    endpoint, which tells the client to fall back — never a silent partial turn."""
    ctx = await _prepare_turn(session_id, respondent_text)
    parts: list[str] = []
    async for delta in run_chat_stream(
        ctx["persona"],
        ctx["messages"],
        extra_system=ctx["extra_system"],
        volatile_system=ctx["volatile_system"],
        cache=True,
        workspace_id=str(ctx["session"]["workspace_id"]),
        session_id=session_id,
        industry_block=_industry_block(ctx["session"]["industry"]),
    ):
        parts.append(delta)
        yield {"type": "delta", "text": delta}
    result = await _finalize_turn(ctx, "".join(parts))
    yield {"type": "done", **result}


async def build_voice_system(session_id: str) -> list[dict]:
    """The persona + handoff system prompt for a voice call, as prompt-cached content
    blocks. The VAPI custom-LLM endpoint supplies the running conversation from its own
    (transcribed) messages; the verbatim record is captured separately from transcript
    webhooks, so this path is generation-only and never writes utterances.

    MODALITY CONTINUITY (A21 target 4): VAPI only knows the CURRENT call's messages, so
    any earlier stored turns — a dropped call being resumed, or a text thread the
    respondent switched away from — are replayed into the system prompt. Without this a
    reconnect restarts the interview from zero, which is exactly the progress loss the
    reconnect UI promises against.

    CACHING (SIMPLIFY-EF-FINDINGS E/F): the persona + handoff package are a cached stable
    prefix, and (for the interviewer) the replayed transcript is a second cached block, so
    each turn reprocesses only the current-call delta instead of the whole prompt. The
    concatenated blocks are byte-identical to the old single string, so behavior is
    unchanged. Context calls carry an elapsed clock, so their tail stays uncached."""
    pool = await get_pool()
    session = await pool.fetchrow(
        "select s.plan_id, s.session_kind, s.started_at, s.resumable_state, w.industry, "
        "w.name as workspace_name from interview_sessions s "
        "join workspaces w on w.id = s.workspace_id where s.id = $1",
        session_id,
    )
    if session is None:
        raise RuntimeError(f"build_voice_system: no session {session_id}")
    scenario = _session_scenario(session)  # SIMPLIFY I: roleplay bound to a workflow
    # F7 BETA: a 'context' session binds the context-collector persona (no plan handoff;
    # the persona carries the exit-condition table). All other kinds are unchanged.
    if session["session_kind"] == "context":
        cfg = await get_agent_config("context_collector")
        system = load_prompt(cfg["prompt_path"], _industry_block(session["industry"]))
        started = session["started_at"] or datetime.now(timezone.utc)
        elapsed = (datetime.now(timezone.utc) - started).total_seconds() / 60
        cached_stable = system
        volatile_tail = "\n\n" + _context_call_block(session, elapsed)  # has the elapsed clock
        cacheable_transcript = False
    elif scenario:
        # Simulation: the interviewer under test, steered to probe this workflow.
        cfg = await get_agent_config("interviewer")
        system = load_prompt(cfg["prompt_path"], _industry_block(session["industry"]))
        cached_stable = f"{system}\n\n{_scenario_block(scenario)}"
        volatile_tail = ""
        cacheable_transcript = True
    else:
        package = await _load_package(session["plan_id"])
        cfg = await get_agent_config("interviewer")
        system = load_prompt(cfg["prompt_path"], _industry_block(session["industry"]))
        cached_stable = (
            f"{system}\n\n"
            "## Your handoff package for this interview\n"
            "This package is your whole world. You were never told what anyone else said.\n\n"
            f"```json\n{json.dumps(package, ensure_ascii=False, indent=2)}\n```"
        )
        volatile_tail = ""
        cacheable_transcript = True
    prior = await pool.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index",
        session_id,
    )
    transcript = ""
    if prior:
        lines = "\n".join(
            f"{'You' if u['speaker'] == 'agent' else 'Respondent'}: {u['text']}"
            for u in prior
        )
        transcript = (
            "\n\n## The conversation so far — this interview is RESUMING\n"
            "The interview already started (an earlier call, or by text). Below is the "
            "verbatim record. Continue from where it left off: do NOT re-greet, do NOT "
            "repeat the opening arc or the sharing rules, and do not re-ask what is "
            "already answered here.\n\n"
            f"{lines}"
        )
    blocks = [cache_block(cached_stable)]
    if cacheable_transcript:
        if transcript:
            blocks.append(cache_block(transcript))  # stable-growing -> cache the transcript
    else:
        # Context: the elapsed block + transcript ride uncached (order preserved).
        tail = volatile_tail + transcript
        if tail:
            blocks.append({"type": "text", "text": tail})
    return blocks


async def stream_reply(session_id: str, messages: list[dict]):
    """Generation-only streaming for the voice sidecar. `messages` is the Anthropic-
    format conversation the VAPI endpoint assembled from its transcript. Yields reply
    text deltas as they arrive (sub-1.5s first-token target)."""
    system = await build_voice_system(session_id)
    pool = await get_pool()
    kind = await pool.fetchval(
        "select session_kind from interview_sessions where id = $1", session_id
    )
    cfg = await get_agent_config("context_collector" if kind == "context" else "interviewer")
    async with client().messages.stream(
        model=cfg["model"], max_tokens=2048, system=system, messages=messages
    ) as stream:
        async for delta in stream.text_stream:
            yield delta


@handles("run_interview_turn")
async def _run_interview_turn_job(payload: dict) -> None:
    # Voice sidecar enqueue path (priority 10). The reply is stored on the utterance;
    # the transport adapter reads it back. Text chat calls run_interview_turn directly.
    await run_interview_turn(payload["session_id"], payload.get("respondent_text"))
