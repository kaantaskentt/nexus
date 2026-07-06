-- 0001_foundation.sql — Nexus foundation schema
-- Sources: docs/MERGE_PLAN.md Phase 1 (claim ontology), Phase 3 (plan lifecycle),
--          A2 (trust ladder), A3 (round batching), A7 (vendored chassis), A12 (is_demo firewall).
-- Chassis pieces (jobs queue / agent_configs / agent_runs) vendored from Tunç's
-- nexus_backend-main design — see reference/SOURCES.md.

create extension if not exists vector;

-- ── Tenancy ──────────────────────────────────────────────────────
-- A12: is_demo is a hard firewall. Real engagements start as fresh tenants
-- with zero fixture records; demo fixtures may never reference a real tenant.
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  industry    text,                        -- drives runtime industry injection (A14)
  is_demo     boolean not null default false,
  config      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ── Entity registry (EK 2.1) ─────────────────────────────────────
-- Canonical person/department/system records. Vendor-side people can never
-- become client entities: is_vendor_side is set at insert and immutable.
create type entity_type as enum ('person', 'department', 'system');

create table entities (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id),
  entity_type    entity_type not null,
  canonical_name text not null,
  aliases        text[] not null default '{}',
  role           text,                     -- job title / function (F4: names + roles only)
  department     text,
  is_vendor_side boolean not null default false,
  source         text not null default 'interview'
                 check (source in ('scraped', 'interview', 'manual', 'fixture')),
  created_at     timestamptz not null default now(),
  unique (workspace_id, entity_type, canonical_name)
);

-- ── Interview rounds (A3 batching) ───────────────────────────────
-- Snapshot re-renders only when a round completes — never mid-interview,
-- never per-interview while a round is open.
create table interview_rounds (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  label        text,
  status       text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── Interview plans + lifecycle state machine (Phase 3) ──────────
create type plan_state as enum (
  'DRAFT', 'NEXUS_CHECK', 'AWAITING_APPROVAL', 'APPROVED', 'SENT', 'OPENED',
  'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'COMPILED', 'NO_RESPONSE', 'REVOKED'
);

create table interview_plans (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id),
  round_id            uuid references interview_rounds(id),
  interviewee_id      uuid references entities(id),
  state               plan_state not null default 'DRAFT',
  is_custom_path      boolean not null default false,  -- flips review order (admin first)
  mission             jsonb not null default '{}',     -- goal / known_context / topics(must-hit,nice-to-have) / DoD / handling_notes
  suggested_questions jsonb not null default '[]',
  never_list          jsonb not null default '[]',     -- hard rules; override objectives
  suppressed_flags    jsonb not null default '[]',     -- SUPPRESSED-BY-ADMIN + indirect-route proposals (F30/F36)
  change_log          jsonb not null default '[]',     -- refine-chat audit trail
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table plan_state_transitions (
  id         bigint generated always as identity primary key,
  plan_id    uuid not null references interview_plans(id),
  from_state plan_state,
  to_state   plan_state not null,
  actor      text not null,                -- 'admin' | 'nexus_team' | 'system' | 'interviewee'
  note       text,
  created_at timestamptz not null default now()
);

-- ── Handoff packages (Phase 3) ───────────────────────────────────
-- The runtime interviewer receives ONLY this package: objectives, questions,
-- rules/NEVER list, vocabulary, approach notes, DoD, time budget.
-- Never claim text, never quarantined records — enforced at package
-- construction (the builder queries the deny-by-default view and strips claims).
create table handoff_packages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references interview_plans(id) unique,
  package    jsonb not null,
  built_at   timestamptz not null default now()
);

-- ── Interview sessions ───────────────────────────────────────────
create table interview_sessions (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id),
  plan_id        uuid references interview_plans(id),
  round_id       uuid references interview_rounds(id),
  interviewee_id uuid references entities(id),
  modality       text not null default 'text' check (modality in ('text', 'voice')),
  -- Invite tokens: expiry + single-session binding (Phase 0 security patch)
  invite_token   text unique,
  token_expires_at timestamptz,
  status         text not null default 'pending'
                 check (status in ('pending', 'active', 'paused', 'completed', 'expired')),
  resumable_state jsonb not null default '{}',   -- pause/resume (A5)
  language       text not null default 'en',
  started_at     timestamptz,
  ended_at       timestamptz,
  created_at     timestamptz not null default now()
);

-- ── Utterances (verbatim — hedges are data) ──────────────────────
create table utterances (
  id              bigint generated always as identity primary key,
  session_id      uuid not null references interview_sessions(id),
  turn_index      int not null,
  speaker         text not null check (speaker in ('agent', 'respondent')),
  text            text not null,            -- verbatim incl. fillers/false starts
  word_timestamps jsonb,                    -- voice: word-level timing (Phase 5)
  audio_ref       text,                     -- pointer to stored audio segment
  created_at      timestamptz not null default now(),
  unique (session_id, turn_index)
);

-- ── Scraped sources (Stage 1) ────────────────────────────────────
create table scrape_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  kind         text not null check (kind in ('website', 'linkedin_people', 'other')),
  url          text,
  content      jsonb not null,
  scraped_at   timestamptz not null default now(),
  is_stale     boolean not null default false  -- stale-scrape failsafe (A2)
);

-- ── Claim records (Phase 1 — the product's soul) ─────────────────
-- Trust ladder (F22 + A2): SCRAPED < GUESS < CLAIMED < CONFIRMED < VERIFIED.
-- Tags never upgrade: records are immutable; corrections supersede (F18).
create type claim_kind  as enum ('statement', 'directive', 'admission', 'correction');
create type claim_topic as enum ('pain', 'process_step', 'person', 'tool', 'vocabulary',
                                 'time_or_cost', 'company_fact', 'success_criteria');
create type trust_tag   as enum ('SCRAPED', 'GUESS', 'CLAIMED', 'CONFIRMED', 'VERIFIED');

create table claim_records (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id),
  session_id        uuid references interview_sessions(id),   -- null for scraped-origin
  scrape_source_id  uuid references scrape_sources(id),
  speaker_id        uuid references entities(id),
  subject_id        uuid references entities(id),             -- who/what the claim is about
  kind              claim_kind not null,
  topic             claim_topic not null,
  tag               trust_tag not null,
  claim_text        text not null,
  evidence_quote    text,                    -- verbatim supporting quote
  evidence_ts       text,                    -- transcript timestamp / locator
  hedge_signals     jsonb not null default '[]',  -- detected hedges (F20)
  -- Sentiment quarantine (non-negotiable #4): enforced at the data layer.
  sentiment_flag    boolean not null default false,
  approach_note     text,                    -- interviewer-facing handling note
  quarantined       boolean not null default false,
  mention_count     int not null default 1,
  supersedes_id     uuid references claim_records(id),        -- F18: corrections supersede
  spine_slots       jsonb,                   -- A10: slot metadata preserved for future skill compiler
  provenance        jsonb not null default '{}',
  embedding         vector(1536),
  created_at        timestamptz not null default now()
);

create index claim_records_workspace_idx on claim_records (workspace_id);
create index claim_records_topic_idx     on claim_records (workspace_id, topic);
create index claim_records_session_idx   on claim_records (session_id);

-- Non-negotiable #1: tags never upgrade, truth emerges from comparing records.
-- Immutable core fields; mention_count is the only mutable counter.
create or replace function claim_records_immutable() returns trigger as $$
begin
  if new.tag is distinct from old.tag
     or new.claim_text is distinct from old.claim_text
     or new.evidence_quote is distinct from old.evidence_quote
     or new.kind is distinct from old.kind
     or new.quarantined is distinct from old.quarantined
     or new.sentiment_flag is distinct from old.sentiment_flag then
    raise exception 'claim_records core fields are immutable — supersede with a new record (F18)';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger claim_records_immutable_trg
  before update on claim_records
  for each row execute function claim_records_immutable();

-- Deny-by-default client visibility (non-negotiable #4, Phase 1):
-- every client-facing query goes through this view, never the base table.
create view client_visible_claims as
  select * from claim_records where quarantined = false;

-- ── Heuristics (Stage 2 — renamed from "hypothesis", A1) ─────────
create table heuristics (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id),
  text              text not null,
  falsifiable_as    text not null,           -- F12: falsifiable granularity
  status            text not null default 'open'
                    check (status in ('open', 'confirmed', 'busted', 'partial')),
  raised_unprompted boolean,                 -- F13: credited only when raised unprompted
  scored_at         timestamptz,
  evidence_claim_ids uuid[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- ── Pain scores (A2: LLM-judged bands, never decimals) ───────────
create table pain_scores (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null references claim_records(id) unique,
  band          text not null check (band in ('low', 'moderate', 'high', 'severe')),
  rationale     text not null,
  rater_version text not null,
  created_at    timestamptz not null default now()
);

-- ── Conflicts / perception gaps (Phase 6 engine, Phase 1 linkage) ─
create table claim_conflicts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id),
  claim_a_id    uuid not null references claim_records(id),
  claim_b_id    uuid not null references claim_records(id),
  kind          text not null check (kind in ('perception_gap', 'worker_vs_worker', 'ceo_vs_floor')),
  status        text not null default 'disputed'
                check (status in ('disputed', 'resolved')),
  resolution    jsonb,                       -- F21 precedence result when Emre's policy lands
  created_at    timestamptz not null default now(),
  check (claim_a_id <> claim_b_id)
);

-- ── Snapshot cards (Phase 3 — append-only re-render per round) ───
create table snapshot_cards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  round_id     uuid references interview_rounds(id),
  card_type    text not null check (card_type in
               ('learned', 'area_to_investigate', 'suggested_person', 'conflict_point')),
  content      jsonb not null,
  confidence   text check (confidence in ('high', 'verified', 'reported', 'scraped')), -- F35 split
  render_batch int not null default 1,
  created_at   timestamptz not null default now()
);

-- ── Workflows + spine-slot metadata (Phase 6 / A10) ──────────────
create table workflows (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  session_id   uuid references interview_sessions(id),
  name         text not null,
  created_at   timestamptz not null default now()
);

create table workflow_steps (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references workflows(id),
  step_index   int not null,
  tool         text,
  action       text not null,
  input        text,
  output       text,
  verified     text not null default 'unverified'
               check (verified in ('verified', 'partial', 'unverified')),
  -- A10: spine slots (task/trigger/steps/rules/exceptions/tools/output/success/examples)
  -- + 0/1/2 sufficiency — future skill compiler consumes this without redesign.
  spine_slots  jsonb not null default '{}',
  slot_scores  jsonb not null default '{}',
  claim_ids    uuid[] not null default '{}',
  unique (workflow_id, step_index)
);

-- ── Vendored chassis (Tunç): jobs queue, agent configs, run audit ─
create table jobs (
  id          bigint generated always as identity primary key,
  kind        text not null,
  payload     jsonb not null default '{}',
  status      text not null default 'queued'
              check (status in ('queued', 'running', 'done', 'failed')),
  priority    int not null default 100,      -- lower = sooner; interview turns run at 10
  run_after   timestamptz not null default now(),
  attempts    int not null default 0,
  max_attempts int not null default 3,
  locked_by   text,
  locked_at   timestamptz,
  last_error  text,
  created_at  timestamptz not null default now()
);
create index jobs_claim_idx on jobs (status, run_after, priority) where status = 'queued';

-- Model tiering (Phase 0 #1): strong model in demanding seats, never mini.
create table agent_configs (
  id             uuid primary key default gen_random_uuid(),
  agent_name     text not null unique,
  model          text not null,
  temperature    numeric not null default 1.0,
  prompt_path    text not null,              -- file in prompts/ — the IP stays in the repo
  prompt_version text not null default 'v1',
  config         jsonb not null default '{}',
  updated_at     timestamptz not null default now()
);

create table agent_runs (
  id             bigint generated always as identity primary key,
  agent_name     text not null,
  model          text not null,
  prompt_version text not null,
  workspace_id   uuid references workspaces(id),
  session_id     uuid references interview_sessions(id),
  input_ref      jsonb not null default '{}',
  output_ref     jsonb not null default '{}',
  retrieval_queries jsonb not null default '[]', -- Phase 0 #2: grounding must be non-empty when claimed
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  status         text not null default 'ok' check (status in ('ok', 'error')),
  error          text,
  created_at     timestamptz not null default now()
);

-- ── Seed: agent tiering (Phase 0) ────────────────────────────────
insert into agent_configs (agent_name, model, prompt_path) values
  ('stage1_recon',          'claude-sonnet-4-6',            'prompts/agents/stage1-recon.md'),
  ('stage2_heuristics',     'claude-sonnet-4-6',            'prompts/agents/stage2-heuristics.md'),
  ('stage4_compiler',       'claude-sonnet-4-6',            'prompts/agents/stage4-compiler.md'),
  ('pain_rater',            'claude-sonnet-4-6',            'prompts/rubrics/pain-bands.md'),
  ('plan_generator',        'claude-sonnet-4-6',            'prompts/agents/plan-generator.md'),
  ('plan_refine_chat',      'claude-sonnet-4-6',            'prompts/agents/plan-refine-chat.md'),
  ('interviewer',           'claude-sonnet-4-6',            'prompts/agents/stage7-interviewer.md'),
  ('collision_detector',    'claude-sonnet-4-6',            'prompts/agents/collision-detector.md'),
  ('perception_gap',        'claude-sonnet-4-6',            'prompts/agents/perception-gap.md'),
  ('snapshot_renderer',     'claude-sonnet-4-6',            'prompts/agents/snapshot-renderer.md'),
  ('report_sop_generator',  'claude-sonnet-4-6',            'prompts/agents/report-sop-generator.md'),
  ('nexus_check_reviewer',  'claude-sonnet-4-6',            'prompts/agents/nexus-check-reviewer.md'),
  ('chunker',               'claude-haiku-4-5-20251001',    'prompts/agents/chunker.md');
