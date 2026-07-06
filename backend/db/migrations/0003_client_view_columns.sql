-- 0003_client_view_columns.sql — deny-by-default at the VIEW's column list (QA F3).
-- The compiler spec marks approach_note and sentiment_flag "never client-visible".
-- Filtering quarantined rows in the WHERE clause is not enough — the column list is
-- the contract. A future client-facing render that does `select *` must not even be
-- able to reach these fields. So the view enumerates safe columns and omits both.

-- Replacing a select-* view with a narrower column list requires a drop first
-- (create-or-replace can only append columns, never remove them).
drop view if exists client_visible_claims;
create view client_visible_claims as
  select
    id, workspace_id, session_id, scrape_source_id, speaker_id, subject_id,
    kind, topic, tag, claim_text, evidence_quote, evidence_ts, hedge_signals,
    mention_count, supersedes_id, spine_slots, provenance, embedding, created_at
  from claim_records
  where quarantined = false;
