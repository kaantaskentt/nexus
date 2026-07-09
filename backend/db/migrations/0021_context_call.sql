-- 0021_context_call.sql — F7 BETA "Conduct the context call with Nexus" (wire pass,
-- July 9 marathon shift 2; plan in docs/F7-WIRING.md). The founder/admin does the
-- Stage-3 context call WITH the product (voice/text) instead of uploading a transcript.
-- Sessions use the EXISTING session_kind 'context' (designed into the constraint since
-- 0007 and never skipped by compile — the transcript feeds the same pipeline as an
-- uploaded CEO call, which is the whole point). This migration only seeds the persona:
-- a STRONG-model seat (non-negotiable 7 — same class as the interviewer, never a mini).

insert into agent_configs (agent_name, model, prompt_path) values
  ('context_collector', 'claude-sonnet-4-6', 'prompts/agents/stage3-context-collector.md')
  on conflict (agent_name) do nothing;
