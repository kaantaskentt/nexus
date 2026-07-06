-- 0006_workflow_overlays.sql — the workflow editor's ontology-safe edit layer (V2 #21).
--
-- workflow_steps is the claim-derived truth and is NEVER mutated by the editor (same
-- principle as claim_records immutability): admin edits are append-only OVERLAY rows.
-- The "effective" workflow the editor renders = base steps folded with active overlays.
-- Every edit carries provenance (actor, created_at, prior_value); a remove is a
-- soft_hide overlay (reversible via unhide), never a delete. Manual steps exist ONLY as
-- add_manual overlays (source='manual', not evidence-backed) — they never enter
-- workflow_steps, so a claim-derived step and an admin-invented one are structurally
-- distinguishable.

create table workflow_step_overlays (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references workflows(id),
  -- References a base workflow_steps.id OR a prior add_manual overlay's id (both uuids).
  -- NULL for add_manual: that row IS the manual step, keyed by its own id.
  step_id      uuid,
  op           text not null check (op in
                 ('reorder','rename','annotate','add_manual','soft_hide','unhide')),
  payload      jsonb not null default '{}',
  prior_value  jsonb,                                   -- value before this op (provenance)
  actor        text not null default 'admin',
  created_at   timestamptz not null default now()
);
create index workflow_step_overlays_wf_idx on workflow_step_overlays (workflow_id, created_at);

-- Generated SOP document (the pilot deliverable). One current doc per workflow; the
-- report_sop_generator job overwrites it, folding the active overlays so the SOP reflects
-- the admin's edits. Documents only — never an executable skill (A7/A10).
create table workflow_sops (
  workflow_id  uuid primary key references workflows(id),
  document     jsonb not null,
  generated_at timestamptz not null default now()
);
