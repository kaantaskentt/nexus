-- 0024_live_captures.sql — SIMPLIFY lane E (docs/SIMPLIFY-PLAN.md §4-E+F/§5, Feedback E).
-- The "Captured live" panel needs real data. There is NO live extraction today (codemap
-- Area 5): claims are produced only post-compile, and the Observer's live notes are
-- admin-typed. This table holds STRUCTURAL items a per-turn extractor pulls from the
-- respondent's own words while the conversation runs — teams, systems, workflow mentions,
-- decision rules, goals, open questions.
--
-- NON-NEGOTIABLES held at the data layer, not by prompt discipline:
--   * These are session-scoped DISPLAY data, NOT claim records. They never enter the KB.
--     The Stage-4 compiler stays the ONLY producer of claim_records (non-negotiable #1:
--     truth emerges from comparing records, never from a live guess). claim_ref is a
--     reserved forward link (post-compile, a capture could point at the claim it became);
--     it is nullable and unused in v1.
--   * kind is a closed structural set — no 'sentiment', no 'person_opinion'. Sentiment
--     about a named person is quarantined by the extractor before insert (non-negotiable
--     #4), and there is no column here that could carry an evaluative judgment.
--   * A live single-source item is Reported at most on the admin view (A18/A19 ladder);
--     the respondent view carries no confidence badge at all. No tag is stored — the
--     badge is derived at read time, never a stored/second-guessable field.
create table live_captures (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references interview_sessions(id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  kind         text not null check (kind in
               ('team', 'system', 'workflow', 'decision_rule', 'goal', 'open_question')),
  label        text not null,               -- short client-language name ("Front Desk")
  detail       text,                        -- one line of context, structural only
  -- 'capturing' is reserved for a future streaming extractor; the batch extractor writes
  -- rows already persisted, i.e. 'saved'. The panel's "Just added -> Saved" is a client
  -- entrance on genuinely-new saved rows, and the header pulse is driven by a real
  -- in-flight extraction job (never a faked state).
  status       text not null default 'saved' check (status in ('capturing', 'saved')),
  claim_ref    uuid references claim_records(id),  -- reserved forward link, unused in v1
  created_at   timestamptz not null default now()
);
create index live_captures_session_idx on live_captures (session_id, created_at);

-- Strong model in a demanding seat (non-negotiable #7): the extractor reads the newest
-- respondent turn plus the running capture list and must hold the quarantine + no-invention
-- rules, so it is never a mini model. Same tier as the interviewer/compiler.
insert into agent_configs (agent_name, model, prompt_path) values
  ('live_capture_extractor', 'claude-sonnet-4-6', 'prompts/agents/live-capture-extractor.md')
  on conflict (agent_name) do nothing;
