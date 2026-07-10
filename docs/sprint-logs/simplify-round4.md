# SIMPLIFY round-4 (wrap seam) — deploy + smoke; deep verify handed to audit-walk

Deployed commit: **0150dbf** (Railway api+worker + Vercel). Last deploy of the night.
Cargo since 0fd1f3d: P0 opener-ordering fix 55af788 + done-frame fallback 5744777 (+ masking
guard 8c74190 already live) · AreaDrawer wire/clean 51d3692/155ee50 + workflow back-link fd6559b
· design tokens a51e3ef/8c6b4f2 · picker N+1 9b64757 · handler sweep 199ec8c · robustness
72b3cef/71181bb · dedups 2ab8803/0150dbf (_loads + initials()). Snapshot v2 already live.

## Deploy
- Pin verified: all 14 cargo commits ancestors of 0150dbf. Delta touches backend .py (dedups,
  picker N+1, handler sweep, plans/reports/workspaces/chat/compiler/plan/workflow) → Railway + Vercel.
- NO new migrations (guard clean). Intake flag NEXT_PUBLIC_INTAKE_ENABLED=1 persists from round-3.
- Railway api SUCCESS (a73174a0) + worker SUCCESS (dd80fe71). Vercel READY (nexus-v2-g77w8461w).

## Smoke (seam-1)
- /health ok, /health/deep ok (0 failed / 0 queued / 0 running). /login 200.
- Core pages /home /interviews /workflows return 307 → /login (auth redirect, healthy; no 500).

## Deep verify → audit-walk
- Per lead: browser handed to audit-walk for the deep re-verify batch (P0 opener fix on
  text-from-start both kinds, AreaDrawer live behavior, remaining driven items). lane-design
  gets the token render confirm after. Their verdicts land in their own log.

Prod = 0150dbf. Park follows.
