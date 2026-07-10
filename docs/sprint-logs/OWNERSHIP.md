# FILE OWNERSHIP — single source of truth (team-lead; supersedes ALL messages)

Mailboxes reorder under load. THIS FILE is the ownership record; if a message and this
file disagree, THIS FILE WINS. Check it before editing a contested file. Last update:
July 10 ~00:25 PDT.

| Surface / file | Owner | State |
|---|---|---|
| SnapshotView.tsx + the Insights fold (COMMIT 2: conflicts/findings/opportunities onto v2 Home) | **lane-shell** | build on main@0d4b52b (lane-dbg's landed v2 = the base; never revert) |
| Nav/route retirement (Insights out of NAV, /insights → Home redirect, retire InsightsView) | **lane-shell** | AFTER their fold commit lands |
| Report "Follow up on" → "Open questions" rename | **lane-shell** | anytime |
| Intake agent (ADD-4, task #18, commits 2-5 on top of 2026f50) | **lane-dbg** | adopted from capped lane-k; storage-through-compiler design binds; 0025 applies at seam only |
| P1 clientMessages fix + re-provision + verify + round-2 deploy | **seam-1** | fix SHIPPED to origin (c203bc5) + assistants re-provisioned + GET-verified; headless render check then bundle deploy |
| LiveRoom transcript regression test (elimination proof) | **lane-e** | in flight; NO component-side fix unless the test catches a real component bug |
| vapi_assistant.py / provision_vapi.py | **seam-1** | NOTE: c203bc5 on origin already carries the clientMessages fix — the UNCOMMITTED local copies of these files are seam-1's own working state; nobody else touches them |
| tailwind.config.ts (surface-dark token) | **lane-design** | their batch; leave staged state alone |
| Local main diverged from origin (90028dc vs c203bc5) | **team-lead** | I merge (never rebase) + push — do NOT reconcile yourselves |

lane-dbg: you are OFF SnapshotView permanently (your 0d4b52b stands as the base — good
work). ACK by message that you've switched to intake.
lane-shell: your extract-and-hand-off recommendation is declined only because lane-dbg
is retasked to intake; you own the fold end-to-end exactly as ruled in msg d5d9e5be.
