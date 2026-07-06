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

**OPEN (2 verification items, owners assigned):**
1. Editor live-verify + screenshots → frontend-1 (workflow 37d3d70d…, session 99b4e914… on
   live; routes 200). Closes #21.
2. Perception-gap verdict → prompts-evals-2: run evals/harness/second_round_e2e.py against
   LIVE (re-check Burak plan id post-reseed), fetch report, report if a real ceo_vs_floor
   gap forms. Last packet line.

**MORNING (Kaan):** open the prod URL · FIRST VOICE CALL (send a voice-modality interview
from Burak's plan, respondent page shows "Start voice conversation") · morning-review
packet evals/adjudication/morning-review-packet.md (blind golden labeling, Q1-Q3, F38+
proposals, TOP V3 item: computed coverage-routing) · taste veto batch (V2-PLAN + earlier
7-item list; badge labels + em-dash-exemption ruling logged as named deviations) · Artifact
(same URL, V2 section; editor frames pending item 1).
