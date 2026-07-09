<!-- F7 wiring plan for the builder. Persona + evals are DONE (this task); this is the product
     wiring, NOT implemented here. Concrete file pointers only. Kaan+Emre are the beta test users. -->

# F7 — Beta "Conduct Context Call with Nexus": wiring plan

The persona (`prompts/agents/stage3-context-collector.md`) and its eval suite
(`evals/context_collector/`) exist. Below is how they hook into the product. All BETA-labelled.

## 1. Register the persona (DB seed)
`backend/app/llm.py:53` `get_agent_config(name)` reads the `agent_configs` table and RAISES if a
name is unseeded. Add a row `agent_name = "context_collector"`, `prompt_path =
"prompts/agents/stage3-context-collector.md"`, model **STRONG** (same seat as `interviewer` — never a
mini; Non-negotiable 7). Seed it wherever `interviewer` is seeded (grep `agent_configs` insert/seed).

## 2. Select the persona per session (the core swap)
The interviewer is bound by the literal string `"interviewer"` in three spots in
`backend/app/pipeline/interview.py`: `run_interview_turn` (`run_chat("interviewer", …)` ~line 200),
`build_voice_system` (`get_agent_config("interviewer")` ~line 231), `stream_reply` (~line 263).
Add a `session_kind == "context_call"` branch in each that binds `"context_collector"` instead. The
handoff block differs: a context call has NO interviewee handoff package — pass the exit-condition
table as its context (or nothing; the persona carries the table). Everything else (utterance capture,
resume replay, streaming) is reused unchanged.

## 3. Let its transcript compile (feed the same pipeline)
`backend/app/pipeline/compiler.py:168` `compile_session` is the one choke point. It skips
`session_kind == "voice_test"` (~line 183). A `context_call` session must **NOT** be skipped — it
compiles like any transcript into the same claim-record store, which is the whole point (its records
seed the Company Snapshot + the interview plans). Confirm the `voice_test` guard does not catch it.

## 4. Beta toggle at company creation + Simulations entry
- Toggle lives at workspace creation: `backend/app/routers/workspaces.py` (admin-only, behind a beta
  flag — mirror the F6 dormant-flag pattern). When on, offer "Conduct the context call with Nexus"
  instead of / alongside transcript upload.
- Session mint: create the `context_call` session the way real sessions are minted (not the test-only
  `eval-bootstrap` in `sessions.py:164`, which is `is_demo`). It reuses the `/i/[token]` room and the
  by-token turn routes in `backend/app/routers/sessions.py` — persona picked by `session_kind` (§2).
- Simulations page: `backend/app/routers/simulations.py` is read-only (`/history`, no run endpoint by
  design — park July 8). Adding a launch entry here is a PROPOSED surface; gate it with Kaan before
  building a run path. For now the beta is reachable from company creation, not a Simulations button.

## 5. Voice room reuse
Voice uses `build_voice_system` (§2) + `stream_reply` via the VAPI custom-LLM endpoint
(`backend/app/vapi_assistant.py`). Once §2's `session_kind` branch lands, voice picks up the collector
persona with zero further change. Verbatim transcript capture (webhooks) is unchanged.

## Guards to keep
- Add `stage3-context-collector.md` to the no-em-dash checklist in `prompts/glossary-and-policies.md`
  (it authors client-visible text). The persona already follows the rule; this makes it enforced.
- Reads captured in the call are sentiment-quarantined at the data layer (glossary) — same as any
  transcript. Nothing the CEO says about a person renders where employees can see it.
- BETA label on every surface. The persona will not overclaim; the UI must match (no "builds you a tool").
