# SIMPLIFY — Lane EF log (voice drops + text latency)

Findings: docs/SIMPLIFY-EF-FINDINGS.md. A28 pre-reviews for every behavior change in this
lane live here (team-lead rule July 9: keep them out of SPRINT-STATE.md, the concurrent-write
hotspot; lead merges this into SPRINT-STATE at Phase 4).

## COMMIT 1 — silence-timeout 30 → 60 + re-provision (LANDED 16a2614, verified live)
Today: every live VAPI assistant carried `silenceTimeoutSeconds: 30` (verified by GET); a
respondent pausing ~30s to think got auto-hung-up mid-conversation — Kaan's July 9 cutoffs.
After: 60s in `vapi_assistant.py` + `provision_vapi.py`; re-provisioned the two shared
assistants only (Nexus M/F; casting relics untouched) with the prod `VOICE_SHARED_SECRET`
from Railway. GET-verified: silence=60, auth header intact, voice/opener/interruption tuning
unchanged. Simpler or more complex for the user? SIMPLER: the call stops hanging up on people
who are thinking; nothing else changes.

## COMMIT 2 — voice honest fallback for a silent empty turn (LANDED 2b69513, test_voice 8/8)
Today: `voice.py custom_llm` streamed `stream_reply` then always emitted stop + `[DONE]`; an
empty stream or a mid-stream error left VAPI with an empty assistant turn and the call stalled
into silence (read as a drop). After: the loop counts emitted chars and catches a mid-stream
exception (logged WARNING, not propagated); on zero content it speaks one short honest recovery
line before `[DONE]` ("Sorry, I lost my train of thought for a second. Could you say that
again?", no em-dash). Partial content untouched. 3 new tests. Simpler? SIMPLER: a hiccup is one
human sentence instead of dead air, and hiccups now show in logs.

## COMMIT 3 — prompt caching (caching, NOT truncation) (READY; sequenced to land first)
Today: every turn reprocesses the full persona + handoff package + transcript — measured on
prod agent_runs at avg 8.7k / max ~13k input tokens for ~100 out, driving p90 7.4s / max 79s
turns (SIMPLIFY-EF-FINDINGS E/F). After: Anthropic prompt caching (`cache_control` ephemeral).
`run_chat` splits the system into a CACHED stable prefix (persona + handoff package) and an
UNCACHED volatile tail (elapsed clock, coverage, fade); `build_voice_system` returns cached
content blocks (persona+package cached, transcript cached on the interviewer path; the context
call's elapsed tail stays uncached). Full conversation memory is preserved — NO transcript
truncation (product-critical episode anchoring, per team-lead ruling). The model sees
byte-identical system text (blocks concatenate exactly as the old single string), so the
interviewer's behavior is unchanged; test_context_call updated only because the internal
stable/volatile split moved which kwarg carries the context block.
Measured live (real API, interview-shaped, warm turn): billed input 13,261 → 3 tokens,
cache_read 13,242, latency ~2.3s → ~2.0s, cached tokens ~0.1x cost. Meaningful, so per the
stop-if-sufficient ruling: no transcript cap added. Follow-up flagged (not built): caching the
TEXT-path transcript needs the runtime-status line relocated out of the pre-messages system,
which is an eval-sign-off change — deferred with the text-SSE streaming to the E room lane.
Affected suites green: test_context_call / test_interview / test_voice / test_voice_test_session
/ test_coverage = 24 passed. Simpler or more complex for the user? SIMPLER: turns get faster
and cheaper (make-it-cheap) with zero change to what the interviewer says.
Files: backend/app/llm.py, backend/app/pipeline/interview.py, backend/tests/test_context_call.py.
Sequencing: lands FIRST per team-lead ruling; lane-e stashes its interview.py hunk and sends the
all-clear before I commit (both lanes edit interview.py in one shared tree).
