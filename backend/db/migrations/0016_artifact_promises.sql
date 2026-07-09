-- 0016_artifact_promises.sql — artifact promises (Kaan feature 1, July 8).
-- When a respondent commits to sharing a real document ("I'll send the ICP doc"), the
-- product records the promise and honors it: the done page offers the upload, the admin
-- sees promised-vs-delivered, and a delivered file stays linked to the objective context
-- it arose under. Files live in the DB (bytea, capped in the API) — zero new infra, the
-- same durability as every other record. Auto-send reminders are deliberately NOT built
-- (PROPOSED — needs email/WhatsApp infra); the admin gets a copyable message instead.

create table if not exists artifact_promises (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  session_id        uuid not null references interview_sessions(id) on delete cascade,
  item              text not null,             -- what they offered ("the ICP doc")
  objective_context text,                      -- which topic/objective it arose under
  quote             text,                      -- the verbatim offer, for provenance
  status            text not null default 'promised'
                    check (status in ('promised', 'delivered')),
  created_at        timestamptz not null default now(),
  delivered_at      timestamptz,
  file_name         text,
  file_mime         text,
  file_bytes        bytea
);
create index if not exists artifact_promises_session_idx on artifact_promises(session_id);
create index if not exists artifact_promises_workspace_idx on artifact_promises(workspace_id);

-- The detection seat: scans a completed transcript for genuine sharing commitments.
-- Small, bounded job — runs once per completed interview session.
insert into agent_configs (agent_name, model, prompt_path) values
  ('artifact_promise_scan', 'claude-sonnet-4-6', 'prompts/agents/artifact-promise-scan.md')
  on conflict (agent_name) do nothing;
