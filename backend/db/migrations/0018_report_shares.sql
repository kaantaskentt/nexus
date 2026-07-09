-- 0018_report_shares.sql — Company Report share links (F2 Monday Morning Report,
-- July 8 night marathon). One button mints a share token; the public page composes the
-- report AT READ TIME from the same client-visible views the app renders (snapshot cards,
-- workflows, conflicts, automation opportunities) — the share row stores NO content, so a
-- forwarded link always shows the current truth and quarantine keeps holding at the data
-- layer. Export logic stays modular (company_report.v1 shape) for a future Skills reshape.

create table if not exists report_shares (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  token         text not null unique,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);
create index if not exists report_shares_ws_idx on report_shares(workspace_id);
