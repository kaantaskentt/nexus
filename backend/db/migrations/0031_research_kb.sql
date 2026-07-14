-- 0031_research_kb.sql — Deep Research Knowledge Base
-- Sources: docs/PRD-DEEP-RESEARCH-KB.md §5b (Definition of Done), §5c (chunking +
--          mandatory source citation), §6 (data model), §9 (fallback-eligibility gate).
-- This content sits OUTSIDE the claim ontology on purpose: no trust tag, never a
-- claim_records row, never client-visible evidence. It is reference knowledge about a
-- kind of business, never a fact about a specific one (A14 cross-client boundary).

-- ── Research cases (the "kind of business" bucket) ──────────────
create table research_cases (
  id                   uuid primary key default gen_random_uuid(),
  industry             text not null,
  business_model       text,               -- e.g. "D2C + wholesale"
  scale_band           text,               -- e.g. "boutique <50 staff"
  fingerprint          text not null,        -- normalized industry|model|scale key
  title                text not null,       -- human label for the admin UI
  summary_embedding    vector(1536),        -- similarity match when fingerprints miss
  status               text not null default 'draft'
                       check (status in ('draft', 'approved', 'stale')),
  dod_met              boolean not null default false,  -- §5b — never assumed true
  generation_attempts  int not null default 1,           -- §5b rerun-once policy, capped 2
  origin_workspace_id  uuid references workspaces(id),
  is_demo              boolean not null default false,   -- A12 firewall, fixed at creation
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A12: fingerprint is unique PER is_demo partition, never across it — a demo workspace
  -- and a real tenant in the same industry must never collide on one case row.
  unique (fingerprint, is_demo)
);

create index research_cases_industry_idx on research_cases (industry);

-- ── Research findings (the retrievable content unit) ─────────────
create table research_findings (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references research_cases(id) on delete cascade,
  section      text not null check (section in
               ('process_areas', 'tools_systems', 'roles_org', 'kpis_benchmarks',
                'failure_modes', 'vocabulary', 'definition_of_done', 'seasonality',
                'compliance')),
  title        text,
  body         text not null,
  source_url   text not null,   -- §5c: mandatory, code-cross-checked against tool results
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

create index research_findings_case_idx on research_findings (case_id);
create index research_findings_section_idx on research_findings (case_id, section);

-- ── Workspace ↔ case links ────────────────────────────────────────
create table workspace_research_links (
  workspace_id uuid not null references workspaces(id),
  case_id      uuid not null references research_cases(id),
  relation     text not null default 'own' check (relation in ('own', 'fallback')),
  linked_at    timestamptz not null default now(),
  primary key (workspace_id, case_id)
);

create index workspace_research_links_case_idx on workspace_research_links (case_id);

-- ── Seed: model tiering (Phase 0 #1 / non-negotiable 7) ──────────
-- STRONG seat, matching every other demanding agent in this codebase (interviewer,
-- compiler, plan_generator) — claude-sonnet-4-6, not a mini model. See PRD §5 for why
-- this isn't Opus: right-sizing to the established convention, a one-line bump later.
insert into agent_configs (agent_name, model, prompt_path) values
  ('deep_research_analyst', 'claude-sonnet-4-6', 'prompts/agents/deep-research-analyst.md')
  on conflict (agent_name) do nothing;
