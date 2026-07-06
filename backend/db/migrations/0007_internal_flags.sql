-- 0007_internal_flags.sql — hide internal scaffolding from client-facing surfaces.
-- Sources: V2-PLAN #22 (is_internal tenants) + #20 safety review (session_kind marking
-- so admin "add as context" + eval-bootstrap sessions never count as real interviews).

-- Workspace-level: eval/e2e/voice scaffolding + the demo-respondent duplicate are not
-- real client workspaces. GET /api/workspaces excludes is_internal by default.
alter table workspaces add column if not exists is_internal boolean not null default false;

-- Session-level: a session is a real interview, an admin context blurb compiled through
-- the standard path, or an eval-harness run. Only 'interview' is client-facing.
do $$ begin
  alter table interview_sessions add column session_kind text not null default 'interview';
exception when duplicate_column then null; end $$;
alter table interview_sessions drop constraint if exists interview_sessions_session_kind_check;
alter table interview_sessions add constraint interview_sessions_session_kind_check
  check (session_kind in ('interview', 'context', 'eval'));

-- Mark the known scaffolding tenants (present on the local dev DB; a no-op on live,
-- which holds only bee-goddess-demo). The real demo stays visible.
update workspaces set is_internal = true
  where slug in ('eval-harness', 'e2e-preflight', 'e2e-ops', 'voice-proving', 'demo-respondent');

-- Backfill: any session living in an internal tenant is an eval/scaffolding run, not
-- a client interview.
update interview_sessions set session_kind = 'eval'
  where workspace_id in (select id from workspaces where is_internal = true)
    and session_kind = 'interview';
