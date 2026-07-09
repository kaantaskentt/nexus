"""Voice sidecar (Phase 5) — VAPI custom-LLM transport over the interview turn engine.

Two surfaces, documented end to end in docs/voice-config.md:

- POST /api/voice/chat/completions — VAPI's custom-LLM mode POSTs each user turn here
  in OpenAI chat-completions shape (plus an injected `call`/`metadata`). We resolve the
  session, stream the interviewer's reply as OpenAI chat.completion.chunk SSE frames
  (first token fast; VAPI speaks as tokens arrive), and terminate with `data: [DONE]`.
  Generation only — the VERBATIM record comes from transcript webhooks, not from here
  (VAPI's LLM messages can be smart-formatted; the compiler needs the raw words).

- POST /api/voice/webhook — VAPI server events. `transcript` (final) stores a verbatim
  utterance with any word timings; `end-of-call-report` stores the recording URL +
  transcript as evidence, closes the session, and enqueues the Stage 4 compile.

VAPI is pure transport: nothing here re-derives interview logic — it all funnels through
the same run engine (non-negotiable: the turn engine is transport-agnostic)."""

import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..db import get_pool
from ..pipeline.interview import _START_NUDGE, stream_reply
from ..queue import enqueue

router = APIRouter()


def _check_secret(supplied: str | None) -> None:
    secret = get_settings().voice_shared_secret
    if not secret:
        return
    # Accept the raw secret or a standard "Bearer <secret>" — VAPI attaches it as a
    # custom Authorization header and may or may not prefix it.
    token = supplied[7:] if supplied and supplied.startswith("Bearer ") else supplied
    if token != secret:
        raise HTTPException(401, "bad or missing voice secret")


def _session_token(body: dict) -> str | None:
    """VAPI echoes the session metadata in DIFFERENT places depending on the payload:
    for web calls started with vapi.start(assistant, overrides) it lives at
    call.assistantOverrides.metadata — NOT call.metadata. The old resolver only checked
    the latter, so every webhook event for web calls was silently dropped as
    unattributable (voice transcripts never stored; the spoken opener never persisted,
    which made the text fallback re-greet). Check every known location."""
    call = body.get("call") or {}
    for path in (
        body.get("metadata"),
        call.get("metadata"),
        (call.get("assistantOverrides") or {}).get("metadata"),
        (body.get("assistantOverrides") or {}).get("metadata"),
    ):
        if isinstance(path, dict) and path.get("session_token"):
            return path["session_token"]
    return None


async def _session_id_for_token(token: str | None):
    if not token:
        raise HTTPException(400, "no session_token in metadata")
    pool = await get_pool()
    sid = await pool.fetchval(
        "select id from interview_sessions where invite_token = $1", token
    )
    if sid is None:
        raise HTTPException(404, "no session for token")
    return str(sid)


def _to_anthropic_messages(oai_messages: list[dict]) -> list[dict]:
    """VAPI sends OpenAI-style messages; we supply our own system prompt, so drop
    system/tool roles and keep the running user/assistant exchange. Anthropic requires
    the sequence to start with a user turn, so prepend the synthetic nudge."""
    msgs = [{"role": "user", "content": _START_NUDGE}]
    for m in oai_messages or []:
        role = m.get("role")
        if role in ("user", "assistant") and m.get("content"):
            msgs.append({"role": role, "content": m["content"]})
    return msgs


def _chunk(delta: dict, finish: str | None) -> str:
    payload = {
        "id": "chatcmpl-nexus",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": "nexus-interviewer",
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
    }
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/chat/completions")
async def custom_llm(request: Request, authorization: str | None = Header(default=None)):
    _check_secret(authorization)
    body = await request.json()
    session_id = await _session_id_for_token(_session_token(body))
    messages = _to_anthropic_messages(body.get("messages", []))

    async def sse():
        yield _chunk({"role": "assistant"}, None)
        try:
            async for delta in stream_reply(session_id, messages):
                yield _chunk({"content": delta}, None)
        finally:
            yield _chunk({}, "stop")
            yield "data: [DONE]\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


@router.post("/webhook")
async def webhook(request: Request, authorization: str | None = Header(default=None)):
    _check_secret(authorization)
    body = await request.json()
    message = body.get("message", {})
    mtype = message.get("type")
    call = message.get("call") or {}
    # Webhook payloads nest the call under message.call — resolve against that shape
    # first, then the raw body (covers both webhook and custom-llm shapes).
    token = _session_token({"call": call}) or _session_token(message) or _session_token(body)

    pool = await get_pool()
    if not token:
        return {"ok": True}  # unattributable event — nothing to store
    session_id = await pool.fetchval(
        "select id from interview_sessions where invite_token = $1", token
    )
    if session_id is None:
        return {"ok": True}

    if mtype == "transcript" and message.get("transcriptType") == "final":
        # Verbatim record of record — store exactly, with any word-level timings.
        speaker = "respondent" if message.get("role") == "user" else "agent"
        idx = await pool.fetchval(
            "select coalesce(max(turn_index), -1) + 1 from utterances where session_id = $1",
            session_id,
        )
        await pool.execute(
            """insert into utterances (session_id, turn_index, speaker, text, word_timestamps, audio_ref)
               values ($1,$2,$3,$4,$5,$6)""",
            session_id, idx, speaker, message.get("transcript", ""),
            json.dumps(message.get("words")) if message.get("words") else None,
            (message.get("artifact") or {}).get("recordingUrl"),
        )

    elif mtype == "end-of-call-report":
        artifact = message.get("artifact") or {}
        recording = artifact.get("recording") or {}
        recording_url = recording.get("stereoUrl") or recording.get("url") or artifact.get("recordingUrl")
        prior = await pool.fetchval(
            "select resumable_state from interview_sessions where id = $1", session_id
        )
        state = json.loads(prior) if isinstance(prior, str) else (prior or {})
        state["recording_url"] = recording_url
        state["final_transcript"] = artifact.get("transcript")
        await pool.execute(
            """update interview_sessions
               set status = 'completed', ended_at = $2, resumable_state = $3 where id = $1""",
            session_id, datetime.now(timezone.utc), json.dumps(state),
        )
        # Hand the verbatim transcript to the Stage 4 compiler. F7: a context call
        # auto-renders the snapshot (CEO/discovery-class; see sessions.py complete).
        kind = await pool.fetchval(
            "select session_kind from interview_sessions where id = $1", session_id
        )
        compile_payload = {"session_id": str(session_id)}
        if kind == "context":
            compile_payload["render_snapshot"] = True
        await enqueue("compile_session", compile_payload)
        # Disclosure screen beside the compile (Emre stage-7 §7, A24) — see sessions.py.
        await enqueue("screen_disclosures", {"session_id": str(session_id)})
        await enqueue("scan_artifact_promises", {"session_id": str(session_id)})

    elif mtype == "status-update" and message.get("status") == "ended":
        await pool.execute(
            "update interview_sessions set status = 'completed' where id = $1 and status <> 'completed'",
            session_id,
        )

    return {"ok": True}
