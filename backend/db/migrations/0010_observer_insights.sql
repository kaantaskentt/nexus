-- 0010_observer_insights.sql — the Observer view's "Add insight" store (A19).
-- Sources: MERGE_PLAN A19 (Observer: timestamped insight cards + Add insight button;
-- correction #1: live badges come from the REAL trust ladder, never all-Verified).
--
-- An observer insight is a human note taken DURING a live interview: a single voice,
-- in the moment, uncorroborated. That is the definition of the CLAIMED tier, and the
-- check constraint pins it AT THE DATA LAYER — a live note can never be stored as
-- anything stronger (non-negotiable #1: tags never upgrade; truth emerges from comparing
-- records after compile, and compiled truth lives in claim_records, not here).

create table if not exists observer_insights (
  id           bigint generated always as identity primary key,
  session_id   uuid not null references interview_sessions(id),
  text         text not null,
  trust_tag    text not null default 'CLAIMED' check (trust_tag = 'CLAIMED'),
  created_at   timestamptz not null default now()
);

create index if not exists observer_insights_session_idx on observer_insights(session_id);
