-- 0027_harm_incident_review.sql — R6 (Kaan ruling): in-app admin incident inbox.
-- Adds a reviewer acknowledge/review state to harm_incidents so the reviewer-scoped admin
-- inbox can mark an incident handled. Mirrors the sealed_flags review vocabulary. No
-- verbatim is added — the incident stays minimized (category / bucket / timestamp /
-- session_ref + notify + now review state). Reviewer-only surface, never client-visible.

alter table harm_incidents
  add column if not exists review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'reviewed', 'dismissed')),
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

create index if not exists harm_incidents_review_idx on harm_incidents (review_status);
