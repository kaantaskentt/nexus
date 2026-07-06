# Voice sidecar — VAPI configuration (Phase 5)

Sources: MERGE_PLAN Phase 5 · A5 (pause/resume, verbatim, latency) · Kaan July 6 "full VAPI depth" instruction · VAPI docs (custom-LLM `using-your-server`, server webhook events, OpenAI-compatibility).

**Principle:** VAPI is pure transport. Telephony/web calls, STT, TTS, and turn-taking are VAPI's; every word of interview *logic* stays in our turn engine (`app/pipeline/interview.py`). The assistant's brain is our custom-LLM endpoint; the verbatim record of the call comes from transcript webhooks, not from the LLM messages. This is what keeps the turn engine transport-agnostic (text chat and voice share one brain).

## Our two endpoints

| Endpoint | VAPI setting | What it does |
|---|---|---|
| `POST /api/voice/chat/completions` | `model.url` (base; VAPI appends `/chat/completions`) | Receives each user turn as OpenAI chat-completions; streams the interviewer's reply as `chat.completion.chunk` SSE, ending `data: [DONE]`. Generation only. |
| `POST /api/voice/webhook` | `serverUrl` | Receives `transcript` (final → verbatim utterance) and `end-of-call-report` (recording URL + transcript stored as evidence, session closed, Stage 4 compile enqueued). |

Both check an `Authorization` shared secret when `VOICE_SHARED_SECRET` is set. Session identity travels in `metadata.session_token` (the interview invite token) — set it in `assistant.metadata` when creating the call; VAPI echoes it on every custom-LLM request and on the call object in webhooks.

## Assistant config (the settings that matter, and why)

```jsonc
{
  "model": {
    "provider": "custom-llm",
    "url": "https://<host>/api/voice",   // VAPI POSTs <url>/chat/completions
    "model": "nexus-interviewer",
    "temperature": 1.0
  },

  // (1) VERBATIM TRANSCRIBER — hedges are data; smart-formatting destroys the product.
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "smartFormat": false,        // no auto punctuation/number normalization
    "language": "en"             // TR designed-in; switch per invite language
  },

  // (2) PATIENT ENDPOINTING — episodic recall needs 2–3s of thinking silence without
  // the agent barging in. CIT ("think about the last time…") produces long pauses.
  "startSpeakingPlan": {
    "waitSeconds": 2.5,                 // don't treat a recall pause as end-of-turn
    "smartEndpointingPlan": { "provider": "livekit" }
  },

  // (6) INTERRUPTION — yield immediately; never talk over the respondent.
  "stopSpeakingPlan": {
    "numWords": 1,               // any word from them stops our TTS at once
    "voiceSeconds": 0.2,
    "backoffSeconds": 1.0
  },

  // (7) SILENCE — a gentle check-in, never an auto hang-up. Non-response is signal,
  // not a failure; the persona offers a pause, it does not end the call.
  "silenceTimeoutSeconds": 30,   // long; the check-in message is the persona's job
  "maxDurationSeconds": 3600,

  // (4) RECORDING + WEBHOOKS — raw audio + verbatim transcript are evidence sources.
  "artifactPlan": { "recordingEnabled": true, "videoRecordingEnabled": false },
  "serverUrl": "https://<host>/api/voice/webhook",
  "serverMessages": ["transcript", "end-of-call-report", "status-update"],

  // (5) MINIMAL analysisPlan — the Stage 4 compiler owns extraction. We do NOT let
  // VAPI summarize or structure the call; a second summarizer would fight the compiler.
  "analysisPlan": {
    "summaryPlan":   { "enabled": false },
    "structuredDataPlan": { "enabled": false },
    "successEvaluationPlan": { "enabled": false }
  },

  "metadata": { "session_token": "<interview invite_token>" }
}
```

### (3) Custom-LLM streaming — sub-1.5s first token
`/api/voice/chat/completions` streams from `stream_reply()` the instant the model emits its first delta, wrapped as OpenAI chunks. No blocking work runs before the first token: the collision/conflict detection is a post-turn async job (never in the reply path), and the handoff package is loaded once per turn from a single row. Reply length is capped (`max_tokens=2048`) so spoken turns stay short.

### Pause / resume (A5)
The persona offers a pause at ~20 minutes; a VAPI call ending is not the interview ending. The same invite token resumes: a new call created with the same `metadata.session_token` continues on the existing session (its `resumable_state` and stored utterances persist). Session state is keyed by token, never by VAPI call id.

## What we deliberately DON'T use
- **VAPI summary / structured-data / success-evaluation** — the compiler is the single extraction authority (A10). Double extraction = drift.
- **Smart formatting / filler removal** — the compiler's trust tagging feeds on hedges and false starts; verbatim STT is non-negotiable.
- **Word-level timestamps** are stored when VAPI provides them (`transcript.words`), but timing is a nicety; the verbatim text is the product.

## Open items (need Kaan / infra)
- VAPI account + assistant provisioning and the public `model.url` / `serverUrl` (deploy-time; the endpoints are built and unit-tested against the documented contract).
- Voice selection (one warm male + one warm female) — a dedicated Kaan session (A11.4). Not blocking the engine.
- Hume-style prosody / live emotion detection is explicitly Phase 2 (A5) — logged, not built.
