-- 0026_harm_incidents.sql — Section 7 imminent-harm incident record (A24 ADOPT).
-- Sources: docs/emre-inbox/section-7-imminent-harm.md §7.3/§7.6 (quarantine + minimize) ·
-- KAAN-RULINGS-jul10 R2 (reviewer notification = email) · Non-negotiable 4 (safety at the
-- data layer). Extends the sealed_flags layer (0011): where sealed_flags carries a factual
-- reviewer_summary for the Tier-2 allegation review flow, this table is the STRICTER
-- Section-7 minimization: the record a reviewer is notified about and acts on holds ONLY
-- {category, coarse bucket, timestamp, session_ref}. It has NO summary / text / turn_refs
-- column BY DESIGN — "the safe posture is not to secure this data well, it is not to hold
-- it" (§7.6). A reviewer navigates to the fuller sealed_flag via sealed_flag_id.
--
-- Access is reviewer-scoped and NEVER client-visible: no compile / conflict / snapshot /
-- report / KB path reads this table, and there is no client-facing route. The retaliation
-- fork (§7.7 — a disclosure of the client's own wrongdoing is never routed to the client
-- contact) is honored structurally: no client-visible path to this record exists.
--
-- Deletion (handled by FK semantics so the cascade code in pipeline/deletion.py is not
-- touched): session_id is ON DELETE SET NULL, so an interview delete RETAINS the incident
-- with its session ref nulled — the same safety-layer-survives doctrine sealed_flags uses.
-- workspace_id is ON DELETE CASCADE, so the (gated-off) company delete removes the tenant's
-- incidents, matching the sealed_flags workspace-delete ruling.

create table if not exists harm_incidents (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  session_id     uuid references interview_sessions(id) on delete set null,  -- the session_ref
  category       text not null check (category in
                   ('harassment', 'discrimination', 'safety', 'illegality',
                    'imminent_harm', 'abrupt_quit_after_sensitive', 'other')),
  -- Coarse bucket the agent's recognition maps to; the reviewer assigns the final tier
  -- (§7.5 — the party that witnesses an event does not rank it). red = danger to life
  -- (screen tier 3); amber = serious harm / wrongdoing (screen tier 2); yellow reserved.
  bucket         text not null check (bucket in ('red', 'amber', 'yellow')),
  -- Reviewer-only navigation to the fuller sealed_flag; not verbatim, never client-visible.
  sealed_flag_id uuid references sealed_flags(id) on delete set null,
  -- R2 reviewer-notification tracking. A notification failure NEVER fails the session/job;
  -- the row persists so a reviewer (or a later retry) can still act. 'skipped' = no email
  -- config present (key / recipients absent).
  notify_status  text not null default 'pending'
                   check (notify_status in ('pending', 'sent', 'failed', 'skipped')),
  notified_at    timestamptz,
  created_at     timestamptz not null default now()   -- the timestamp
);

create index if not exists harm_incidents_ws_idx on harm_incidents (workspace_id);
create index if not exists harm_incidents_notify_idx on harm_incidents (notify_status);
