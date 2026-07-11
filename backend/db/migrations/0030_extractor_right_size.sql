-- P1-3 (WS-8, night of July 10): right-size the live-capture extractor. It is the
-- highest-volume seat (93 runs in 3 days — one per respondent turn), and its output is
-- session-scoped DISPLAY data only (the "Captured live" panel + respondent count): never
-- claim records, never the KB, never a safety judgment. Non-negotiable #7 (strong model
-- in demanding seats) is untouched — this seat is exactly the classification/extraction
-- job the night orders name for right-sizing. Haiku is also faster, so the respondent's
-- capture counter ticks sooner. Other seats (pain_rater, artifact_promise_scan) write
-- product-visible data and stay PROPOSED-only in OVERNIGHT_PLAN.md.
update agent_configs
   set model = 'claude-haiku-4-5-20251001'
 where agent_name = 'live_capture_extractor';
