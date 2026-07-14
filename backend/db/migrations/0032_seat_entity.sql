-- 0032_seat_entity.sql — optional link from a client seat to a People entity.
-- Grant-from-People stores entity_id so the roster can show "Has access".

alter table user_roles
  add column if not exists entity_id uuid references entities(id) on delete set null;

create index if not exists user_roles_workspace_idx
  on user_roles (workspace_id)
  where workspace_id is not null;
