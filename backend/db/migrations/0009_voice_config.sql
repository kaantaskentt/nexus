-- 0009_voice_config.sql — per-workspace voice settings (Sprint-2 Lane B / task #39).
-- Sources: docs/voice-config.md (assistant shape) · A11.4 (voice selection is an admin
-- choice, not a build-time constant) · A12 (tenant isolation).
--
-- Why a dedicated per-workspace assistant, not a PATCH of the shared ones: two GLOBAL VAPI
-- assistants back every call today (asteria F / orion M). Tuning voice by PATCHing one of
-- those would change the voice for EVERY workspace — a cross-tenant leak in spirit with
-- A12. So a workspace that customizes gets its OWN dedicated VAPI assistant, provisioned
-- server-side with the private key; vapi_assistant_id holds its id. No row (or a null
-- assistant id) => the call falls back to the shared gender-default with a model-generated
-- opener — i.e. today's behavior, unchanged for every workspace that never opens Settings.
--
-- vapi_synced is honest state: a save with no VAPI key, or a failed push, stores the config
-- with vapi_synced=false — never a faked ok. The editor surfaces that plainly.

create table if not exists voice_configs (
  workspace_id      uuid primary key references workspaces(id) on delete cascade,
  gender            text not null default 'F' check (gender in ('F','M')),
  voice_id          text not null default 'asteria',
  speed             numeric not null default 1.0 check (speed >= 0.5 and speed <= 2.0),
  first_message     text,                       -- null => model-generated opener (default)
  vapi_assistant_id text,                       -- the workspace's dedicated assistant, once provisioned
  vapi_synced       boolean not null default false,
  updated_at        timestamptz not null default now()
);
