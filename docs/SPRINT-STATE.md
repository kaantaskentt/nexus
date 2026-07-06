# Sprint state — V2 FINAL (July 6, ~04:00 PT)

**PROD IS LIVE AND PRIMARY:** https://nexus-v2-alpha.vercel.app (V2 frontend, voice-capable)
+ https://nexus-api-production-d644.up.railway.app (api+worker at HEAD c7d8f09: safety
guards, session_kind, workflows router+list route, SOP jobs). CORS+pooler proven from prod
origin. Local :8000 stack restarted at HEAD (fallback). Both DBs reseeded em-dash-clean.

**DONE (all of V2 #18–#26):** design system + 6 surfaces + 3 glass flagships (AreaDrawer,
step drawer, workflow editor) · every-button-works + honest disabled microcopy · badge
system per frozen glossary (Verified/High/Reported/Scraped + tooltips) · em-dash rule
closed-loop (copy, prompts, generated output, seeds, lint, sync test) · #20 chat/refine
APIs with both-doors never_list guard (attack-string tested) · #21 overlays/SOP/Blueprint
backend live + editor UI built · #22 full deploy · #23 audit · #24 re-mine (Question Bank
vendored, spine 9-slot fix) · #25 volume (13/16, 1 trap; terse fix partial win) · #26 VAPI
provisioned + widget deployed (ff9ba48). 52 backend tests, 23 frontend tests, suites green.

**OPEN (1 verification item):**
1. ~~Editor live-verify~~ CLOSED July 6 morning by qa-prod: PASS on all 4 ontology rules
   against prod (overlay provenance, MANUAL tagging, reversible soft-hide, audit trail);
   11 screenshots committed (5162cac). #21 done. Found in the process: Next data-cache
   staleness in api.ts (SSR renders stale on every surface) — urgent fix in flight (#13).
2. ~~Perception-gap verdict~~ CLOSED July 6 morning by qa-prod: 2 ceo_vs_floor gaps form
   in conflict_points on LIVE (perception_gaps[] stays empty — UI wired to the right
   field). Boutique-count gap = confirmed FALSE POSITIVE (comparator used the CEO's
   self-retracted claim); yıldırım gap = real. Same-speaker-retraction exclusion rule
   proposed to Emre in morning packet §6 — nothing patched pending his F21/F41 call.

**PARKED ~10:30 PT July 6 (Kaan moving location; resume SAME session, same orders).
Prod (Vercel + Railway + Supabase) STAYS LIVE while parked — only local work pauses.**

**MORNING SHIFT DONE (32 of 34 board tasks):** all 4 MORNING-ORDERS priorities + Kaan's
multi-company addition (A17) shipped and verified. Prod at e2991d4 (two coordinated
deploys, ~09:55 + ~09:56): admin login (Supabase Auth; /w/* gated, /i/* public) · all 6
nav items live (KB, Insights, Interviews built; Overview removed) · New Company + CEO
upload → progressive snapshot (acceptance-PASSED on prod via real UI: 29 claims/14 cards,
~3.5 min compile — honest timing now in DEMO-RUNBOOK) · cache fix · silent parse-swallow
killed (AgentParseError + raw output persisted; proven self-healing on prod: quality leg
failed loud → retried → populated) · Burak report COMPLETE + honest (new real duration gap
found) · plan-generation API wired (#30, quarantine enforced at data layer, NEXUS_CHECK
first) · plan-gen prompt: hidden-lever objectives + clean-question guard, plan evals now
EXECUTE (runner built) · F42 halo multi-turn eval (real-but-intermittent 2/3) · comparator
same-speaker-retraction fix PRE-STAGED as git-apply patch (evals/adjudication/staged/,
verified 4/4) — one command after Emre ratifies · demo runbook docs/DEMO-RUNBOOK.md.

**IN-FLIGHT (checkpointed at park; bonus 10-min window used):**
- #33 generate-plan button (frontend-1) — WIP checkpoint 2 at 4ad23a8 (mid-edit, may not
  compile); resume notes in the commit message. THE only unfinished code item.
- #34 screenshot sweep (admin-flow) — prepped, deliberately deferred until after the
  final deploy's screenshots; option (a) approved (relocate, keep gitignored pngs ignored).
- ~~interview_quality reliability~~ DONE in the bonus window: root cause was transcript-ECHO
  (instruction placement), fixed (instruction-after-transcript + anti-echo line + tests,
  6ec393c) and LIVE-VERIFIED 3/3 first-attempt (e49f1ca). Rides the final deploy.

**RESUME QUEUE (in order):**
1. frontend-1 finishes #33 → FINAL DEPLOY (team-lead, clean worktree per memory/SPRINT
   deploy mechanics) → smoke → qa-prod drives the FULL chain on the hidden qa tenant:
   generate plan → approve → send → synthetic respondent → report (#18 finale).
2. Rotate demo password admin@nexus.app (admin-flow, create_admin --reset; old one was
   briefly committed then scrubbed at 312080a — rotation mandatory) → relay to Kaan.
3. #34 screenshot sweep = last commit. Update this file at shift end.
4. evals-1: finish quality-prompt fix; mine the #18 transcripts for eval cases.

**OPEN QUESTIONS / KAAN DECISIONS:**
- aurora-atelier tenant visible in prod picker — unclaimed by any lane at park time; if
  not Kaan's own Act-1 test, hide via is_internal like the QA tenant. DO NOT delete.
- Emre ratifications (evidence pre-loaded): F21 same-speaker-retraction (staged patch);
  F42 halo (2/3 multi-turn baseline); F38+ batch. Packet §4-§6.
- Kaan taste batch: coverage_routing feel change (OFF until nod) · 4 em-dash records on
  bee-goddess-demo (ruled documented+deferred-to-reseed; Kaan may override for a cosmetic
  one-time edit) · demo account address (admin@nexus.app) · voice-selection session.
- Kaan+Emre personal admin logins created and verified (creds relayed in chat ~10:05 PT).

**MORNING (Kaan, unchanged):** open prod · FIRST VOICE CALL (voice-modality interview from
Burak's plan) · morning-review packet (blind golden labeling, Q1-Q3, F38+ proposals) ·
taste veto batch · Artifact (V2 section).
