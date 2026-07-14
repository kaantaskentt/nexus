-- 0033_media_shares.sql — mid-interview media → context (Show-me / attach / screenshot).
-- Respondent shares a file, screenshot, or screen recording on /i/{token}. Raw bytes live
-- in private Supabase Storage (path in storage_uri); extraction text + CLAIMED claims are
-- the knowledge product. Raw blobs are retained after extract (do not purge).

create table if not exists media_shares (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  session_id          uuid not null references interview_sessions(id) on delete cascade,
  kind                text not null check (kind in ('file', 'screenshot', 'screen')),
  status              text not null default 'uploading'
                      check (status in ('uploading', 'extracting', 'ready', 'failed', 'discarded')),
  file_name           text,
  mime                text,
  byte_size           bigint not null default 0,
  storage_uri         text,
  twelvelabs_asset_id text,
  extraction_text     text,
  grounding_summary   text,
  error               text,
  compile_session_id  uuid references interview_sessions(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists media_shares_session_idx on media_shares(session_id);
create index if not exists media_shares_workspace_idx on media_shares(workspace_id);

insert into agent_configs (agent_name, model, prompt_path) values
  ('media_extract_document', 'claude-sonnet-4-6', 'prompts/agents/media-extract-document.md'),
  ('media_extract_screen', 'claude-sonnet-4-6', 'prompts/agents/media-extract-screen.md')
  on conflict (agent_name) do nothing;
