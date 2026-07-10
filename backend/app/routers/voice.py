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
import logging
import time

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..db import get_pool
from ..pipeline.interview import _START_NUDGE, stream_reply
from ..pipeline.live_capture import enqueue_extraction
from ..queue import enqueue

router = APIRouter()
log = logging.getLogger("nexus.voice")

# Spoken when a turn produces no content — a model hiccup or a mid-stream error. Without
# this VAPI receives an empty assistant turn and the call stalls into silence (which reads
# as a drop). A short, warm recovery line keeps the call alive and honest. No em-dash.
_EMPTY_TURN_FALLBACK = (
    "Sorry, I lost my train of thought for a second. Could you say that again?"
)


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


async def _ensure_compile_enqueued(pool, session_id) -> bool:
    """Guarantee the Stage-4 compile (+ disclosure + artifact-promise scan) fires exactly
    once for a finished live call, no matter which VAPI end-event arrives or in what order.

    VAPI may send `status-update: ended`, `end-of-call-report`, both, or — on an abnormal
    hangup — only the status-update. Before this, only the report path enqueued, so a call
    that never produced a report was captured-but-never-compiled: records/utterances saved,
    snapshot never composes (the test-mest §2 costume). The compile flag is compare-and-set
    on the session row in the SAME statement that marks it completed, so two near-simultaneous
    webhooks can never double-compile (which would duplicate every record). Returns True only
    for the caller that won the flag — the one that actually enqueued.
    """
    won = await pool.fetchval(
        """update interview_sessions
             set status = 'completed',
                 ended_at = coalesce(ended_at, now()),
                 resumable_state = jsonb_set(
                     coalesce(resumable_state, '{}'::jsonb), '{compile_enqueued}', 'true')
           where id = $1
             and coalesce((resumable_state ->> 'compile_enqueued')::boolean, false) = false
           returning 1""",
        session_id,
    )
    if not won:
        return False
    kind = await pool.fetchval(
        "select session_kind from interview_sessions where id = $1", session_id
    )
    # F7: a context call is the plan-less CEO/discovery class — its compile auto-renders the
    # snapshot (same flag the text complete() and paste paths set; derived from the session
    # kind here, never from which webhook fired).
    compile_payload = {"session_id": str(session_id)}
    if kind == "context":
        compile_payload["render_snapshot"] = True
    await enqueue("compile_session", compile_payload)
    # Disclosure screen + artifact-promise scan ride the same seam (Emre stage-7 §7 / Kaan
    # F1) — see sessions.py complete().
    await enqueue("screen_disclosures", {"session_id": str(session_id)})
    await enqueue("scan_artifact_promises", {"session_id": str(session_id)})
    return True


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
        chars = 0
        try:
            async for delta in stream_reply(session_id, messages):
                chars += len(delta)
                yield _chunk({"content": delta}, None)
        except Exception:
            # A mid-stream failure must not tear the SSE into a silent empty turn — VAPI
            # would speak nothing and the call stalls. Log it (hiccups become visible) and
            # fall through to the honest recovery line below.
            log.warning("voice custom_llm stream failed for session %s", session_id, exc_info=True)
        if chars == 0:
            # No content produced (empty stream or the caught error): say something honest
            # rather than end the turn silent.
            log.warning("voice custom_llm produced no content for session %s; sending fallback", session_id)
            yield _chunk({"content": _EMPTY_TURN_FALLBACK}, None)
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
        # SIMPLIFY E: fire the live-capture extractor off a committed RESPONDENT turn (the
        # webhook transcript path, mirroring the text finalize). Fire-and-forget display
        # data; the handler firewalls non-capture kinds. Voice stores one utterance per
        # speech chunk, so a long answer fires several small deltas — the extractor dedups,
        # so captures accrue without duplicating (make-it-work-then-cheap).
        if speaker == "respondent":
            await enqueue_extraction(str(session_id), idx)

    elif mtype == "end-of-call-report":
        artifact = message.get("artifact") or {}
        recording = artifact.get("recording") or {}
        recording_url = recording.get("stereoUrl") or recording.get("url") or artifact.get("recordingUrl")
        # Store this event's unique evidence (recording + final transcript) with a MERGE, not
        # a full-object overwrite, so it can't clobber the compile_enqueued flag a racing
        # status-update:ended may already have set.
        await pool.execute(
            """update interview_sessions
               set resumable_state = jsonb_set(
                     jsonb_set(coalesce(resumable_state, '{}'::jsonb),
                               '{recording_url}', $2::jsonb),
                     '{final_transcript}', $3::jsonb)
               where id = $1""",
            session_id, json.dumps(recording_url), json.dumps(artifact.get("transcript")),
        )
        # Then guarantee the compile once (idempotent across both end-events). F7 snapshot
        # render is decided inside the helper from the session kind.
        await _ensure_compile_enqueued(pool, session_id)

    elif mtype == "status-update" and message.get("status") == "ended":
        # An abnormal hangup can send this with no end-of-call-report to follow. Mark
        # completed AND guarantee the compile so the call is never captured-but-never-compiled
        # (records saved, snapshot never composes). Idempotent: if the report path already
        # won the compile flag, this is a no-op mark.
        await _ensure_compile_enqueued(pool, session_id)

    return {"ok": True}
