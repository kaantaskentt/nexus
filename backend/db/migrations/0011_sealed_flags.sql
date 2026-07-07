-- 0011_sealed_flags.sql — Tier-2 disclosure sealed flags (Emre stage-7 §7, merged A24).
-- Sources: docs/emre-inbox/stage-7-interview-agent-draft1.md §7 · MERGE_PLAN A24 ·
-- Non-negotiable 4 pattern (safety lives at the data layer, not in prompt discipline).
--
-- A sealed flag records that a Tier-2 allegation (harassment / discrimination / safety /
-- illegality) or a Tier-3 imminent-harm moment surfaced in a session. It lives OUTSIDE
-- the record store on purpose: no reference into claim_records, no client-facing route
-- serves it, no compile / conflict / snapshot / report path reads it. Review is a
-- Nexus-team (Emre) act via ops access; whether anything ever reaches the client is a
-- case-by-case human decision under the services agreement's disclosure clause.
-- Tier 3 rows are allowed by the schema but the live Tier-3 protocol is OPEN (Emre's
-- dedicated pass + Kaan confirmation) — the stub only stops-and-routes, it never handles.

create table if not exists sealed_flags (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id),
  session_id       uuid references interview_sessions(id),
  tier             smallint not null check (tier in (2, 3)),
  category         text not null check (category in
                     ('harassment', 'discrimination', 'safety', 'illegality',
                      'imminent_harm', 'abrupt_quit_after_sensitive', 'other')),
  reviewer_summary text not null,   -- for the Nexus reviewer ONLY; never client-visible
  turn_refs        jsonb,           -- utterance turn_index values grounding the flag
  status           text not null default 'unreviewed'
                     check (status in ('unreviewed', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by      text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists sealed_flags_ws_status_idx on sealed_flags (workspace_id, status);
create index if not exists sealed_flags_session_idx on sealed_flags (session_id);

-- The screen seat: one pass over a completed session's verbatim transcript. STRONG
-- model on purpose — a missed Tier-2 is a silent broken promise to the respondent.
insert into agent_configs (agent_name, model, prompt_path) values
  ('disclosure_screen', 'claude-sonnet-4-6', 'prompts/agents/disclosure-screen.md')
on conflict (agent_name) do nothing;
