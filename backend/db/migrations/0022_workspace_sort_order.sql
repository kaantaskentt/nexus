-- 0022_workspace_sort_order.sql — SIMPLIFY lane A (docs/SIMPLIFY-PLAN.md §4-A).
-- Let the admin drag companies into the order they want in the picker. Nullable with no
-- default: a null means "never dragged", and GET /api/workspaces orders sort_order
-- NULLS LAST then created_at DESC — so an untouched picker is byte-identical to today's
-- newest-first, and dragging only ever pins the rows the user explicitly moved.
alter table workspaces add column if not exists sort_order integer;
