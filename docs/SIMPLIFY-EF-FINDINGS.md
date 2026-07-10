# SIMPLIFY — Phase 2E/F investigation (read-only, uncommitted)

Scope: root-cause the voice connection drops Kaan hit today (Feedback F) and the text-turn
latency (E). No code changed. Evidence = live VAPI assistant config (GET), Railway logs,
and `agent_runs`/`interview_sessions`/`jobs` on prod (`nexus`, project kfauvrvigxxctrnuegoo).

## Shared root cause (both E and F)
Every turn replays the **entire transcript + the full handoff-package JSON** into the model
context. `pipeline/interview.py:271-288` (`build_voice_system`) and the text path's
`_prepare_turn` (L108-125) both re-send the whole package each turn; the transcript grows
unboundedly. Measured on prod (`agent_runs`, 139 interviewer turns / 14 days):

| metric | interviewer |
|---|---|
| avg latency | 5.5 s |
| p50 / p90 | 3.5 s / 7.4 s |
| **max** | **78.8 s** |
| avg input tokens | 8,751 |
| **max input tokens** | **12,948** |
| avg output tokens | 102 |
| errors | 1 |

~100 tokens out for ~9k tokens in: nearly all the latency is prompt-processing of a context
that grows every turn. This slow turn is the thing text has no way to hide and voice has a
30-second guillotine over.

---

## F — Voice connection drops

**Ranked hypotheses**

1. **`silenceTimeoutSeconds = 30` on every live assistant — PRIMARY (high confidence).**
   Confirmed by GET `https://api.vapi.ai/assistant`: `Nexus Interviewer (M)` `0853702b`,
   `(F)` `44d14d38`, and all four CASTING assistants carry `silenceTimeoutSeconds: 30`,
   `maxDurationSeconds: 3600`, `startSpeakingPlan.waitSeconds: 0.4`. VAPI ends the call after
   30 s with no **user** speech. In a reflective interview a respondent who pauses to think
   or recall ("how does the returns process actually work…") for 30 s gets hung up on — which
   is exactly "unexpected cutoff mid-conversation." Set intentionally long in code
   (`vapi_assistant.py:194`, `provision_vapi.py:119`) on the theory the persona's check-in
   covers silence, but 30 s is too tight for genuine reflection. One-value fix.

2. **Slow custom-LLM turns create compounding dead air — CONTRIBUTING (high).** p90 7.4 s,
   max 78.8 s per turn (table above). On voice that is 7-79 s of the assistant "thinking"
   (silent). A slow turn plus a respondent who also goes quiet trips the 30 s window fast.
   Latency climbs through a call because input tokens climb (transcript replay). Also:
   `routers/voice.py:106-113` — if `stream_reply` yields nothing (Anthropic hiccup, or the
   session lookup throws), the SSE `finally` still emits `[DONE]` with **no content**, so
   VAPI receives an empty turn rather than an honest error.

3. **Provisioning/auth drift — LOW-MED (verify, not currently firing).** `VOICE_SHARED_SECRET`
   is absent from local `.env`; if the live assistants' `model.headers`/`server.headers`
   Authorization ever diverges from the API's `voice_shared_secret`, every turn 401s. Not
   happening now — API logs show `POST /api/voice/chat/completions` and `/api/voice/webhook`
   both returning **200** repeatedly today. Flag as a re-provision hazard only.

4. **Worker DB `econnrefused` — LOW / stale, ruled out for live turns.** `nexus-worker` logs
   show repeated `asyncpg…ConnectionFailureError: econnrefused`, but `jobs` shows 170 done in
   3 days, newest 2 min ago, **zero failed** — a transient restart artifact, not a live
   outage. And live turns (text and voice) run in the **API web process**, not the worker
   (`sessions.py` `take_turn` calls `run_interview_turn` directly; only compile/screening go
   through the queue), so this cannot cause call drops regardless.

Session spot-check (voice, last 4 days) is consistent: a healthy 37-turn context call
completed tonight (`affd0abd`, recording saved) alongside short 2-turn `voice_test` runs —
a mix, not a total outage, which fits an intermittent silence-timeout cutoff rather than a
hard endpoint failure. (Note: voice sessions never set `started_at` — only the text
`_finalize_turn` does — so duration is null for voice; a small observability gap, not a bug.)

**Minimal fix list (F)** — do NOT patch yet, this is the plan input:
- Raise `silenceTimeoutSeconds` to ~60-90 s in `vapi_assistant.py:194` + `provision_vapi.py:119`,
  then re-provision. Highest leverage, lowest risk.
- Bound the transcript replay in `build_voice_system` (last-N turns or a rolling summary) to
  cap input tokens → cuts first-token dead air that feeds the timeout.
- Make the SSE path (`voice.py:106`) emit an honest fallback line instead of a silent empty
  `[DONE]` when `stream_reply` produces nothing.
- Verify prod `VOICE_SHARED_SECRET` matches the assistants' Authorization header before any
  re-provision (a PATCH without it strips auth — see the guard at `provision_vapi.py:158`).

---

## E — Text-turn latency

**Findings**
1. **The `/turn` endpoint does NOT stream — confirmed.** `POST /api/sessions/by-token/{token}/turn`
   (`sessions.py:112`) → `run_interview_turn` (`interview.py:221`) → `run_chat` returns the
   **whole** completion; the endpoint returns it as one JSON body. (Streaming exists only on
   the voice path via `stream_reply`.)
2. **Frontend shows only a typing indicator while waiting.** `InterviewClient.tsx:97-110`
   (`interviewerTurn`) sets `typing=true` and renders `TypingDots` until the full reply
   lands — no partial text, no progress. So the respondent watches dots for the entire
   generation.
3. **That wait is median 3.5 s, p90 7.4 s, worst 79 s** (same `agent_runs` table). For a
   consumer chat this is the core latency complaint.
4. **Root is input size, not server overhead.** Per-turn non-LLM work is ~5 short queries
   (`_prepare_turn`); the coverage classifier (a 2nd LLM call) is **OFF** (`config.py:57`
   `coverage_routing=False`). The cost is the ~9k-token prompt (handoff JSON + full transcript)
   for ~100 tokens out.

**Minimal fix list (E)**
- **Prompt-cache the context, do NOT truncate it** (team-lead ruling, supersedes an earlier
  "cap the transcript" idea). Full-conversation memory is product-critical (episode anchoring),
  so the fix is Anthropic prompt caching: `cache_control` breakpoints on the stable prefix
  (persona + handoff package) and on the transcript-so-far, so each turn pays uncached only for
  the new delta. Cuts real TTFT for both modalities without dropping any memory. Lands in the
  E/F backend lane (COMMIT 3).
- **Stream the text turn — DEFERRED to the E room lane.** Add an SSE variant of `/turn` reusing
  the voice `stream_reply` machinery (`pipeline/interview.py:291`) so words appear as they
  generate instead of dots for 3.5-7 s. Deferred deliberately so the endpoint/streaming contract
  is designed once, together with the live-room (Phase 2E) work, not twice. Reuse plan:
  `stream_reply` already yields text deltas; the text endpoint needs an SSE frame (plainer than
  `voice.py`'s OpenAI-chunk wrapper) and must persist the assembled reply via `_finalize_turn` at
  stream end.
- Keep `coverage_routing` off (correct today; turning it on would add a full second LLM call
  per turn).

## Note for the plan
E and F are the same underlying problem wearing two coats: unbounded per-turn context makes
turns slow; text has no streaming to mask it, voice has a 30 s silence cutoff that a slow turn
plus a thinking respondent trips. The fixes: **prompt-cache the context** (not truncate — memory
is product-critical) + the one-line **silence-timeout bump** (30 → 60), with **text streaming**
deferred to the E room lane so the endpoint contract is designed once. All are behavior changes
to existing features, so each is its own revertable commit (A28); the assistant re-provision
needs the `VOICE_SHARED_SECRET` check first (verified July 9: prod secret matches the live
assistants' Authorization header).
