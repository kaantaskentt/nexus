-- 0019_user_roles.sql — Client seats, DORMANT (F6, marathon July 8).
-- A seat maps a Supabase auth user to a role. 'client' seats are scoped to ONE
-- workspace and exist so a client can eventually log in without seeing internal
-- machinery. DORMANT BY DESIGN: the table starts empty, the backend consults it only
-- when CLIENT_SEATS=1 (env, default off), and a user with no row is an admin exactly
-- as today. Zero behavior change for current admins until the flag flips.

create table if not exists user_roles (
  user_id      text primary key,          -- Supabase auth user id (sub)
  email        text,
  role         text not null check (role in ('admin', 'client')),
  workspace_id uuid references workspaces(id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- a client seat without a workspace would be an unscoped client — never valid
  constraint client_seat_needs_workspace check (role <> 'client' or workspace_id is not null)
);
