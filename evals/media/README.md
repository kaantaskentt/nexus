# Media extract evals

Offline fixtures for mid-interview media → context extraction (anti-theater).

## Fixtures
- `fixtures/planted-ui.meta.json` — describes a synthetic screenshot with planted labels
  (`Salesforce`, `Export CSV`). CI asserts golden extraction JSON mentions those tools and
  does not invent unrelated ERPs.
- `fixtures/planted-screen.meta.json` — short screen walkthrough planting `Excel` then
  `Export CSV` steps.

## CI (offline)
```bash
python -m evals.media.run_offline
```
Compares fixture metadata + golden extraction JSON under `goldens/`. No live Claude or
Twelve Labs calls.

## Live smoke (manual, key-gated)
1. Text `/i/...` interview — Share → File (PNG) → wait Ready → ask interviewer about it.
2. Confirm Company Context gains CLAIMED/Reported records from the media context session.
3. Confirm blob still exists in Supabase Storage bucket `media-shares`.
4. Share screen 30–60s → Stop → Ready via Twelve Labs → same ask + KB checks.
5. Expired token cannot upload; Discard mid-upload creates no claims.
