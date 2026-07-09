-- 0017_automation_opportunities.sql — Automation Opportunities + honest ROI
-- (Kaan features 2+3, July 8). Opportunities are derived ONLY from records evidence
-- (manual + repetitive + tool-hop signals); each row cites the claim records it rests
-- on (enforced in the pipeline: zero valid citations = dropped, never stored). ROI is
-- an assumption-transparent ESTIMATE, never presented as fact — the jsonb carries the
-- assumption text and which records (if any) supplied real durations.
-- Concept credit: Tunç's automation_assessor idea, vendored (docs/FOR-TUNC.md).

create table if not exists automation_opportunities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  summary       text not null,
  signals       jsonb not null default '[]',   -- e.g. ["manual","repetitive","tool-hop"]
  claim_ids     jsonb not null,                -- non-empty; validated against real records
  workflow_id   uuid,                          -- the mapped workflow it lives in, if any
  step_ids      jsonb not null default '[]',   -- the automatable steps, for highlighting
  roi           jsonb,                         -- {assumption, low_hours_month, high_hours_month,
                                               --  duration_claim_ids, is_estimate: true}
  render_batch  int not null default 1,
  created_at    timestamptz not null default now()
);
create index if not exists automation_opportunities_ws_idx on automation_opportunities(workspace_id);

insert into agent_configs (agent_name, model, prompt_path) values
  ('automation_assessor', 'claude-sonnet-4-6', 'prompts/agents/automation-assessor.md')
  on conflict (agent_name) do nothing;
