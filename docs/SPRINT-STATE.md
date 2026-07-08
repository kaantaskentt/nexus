# OVERNIGHT PARK NOTE — July 8 ~02:45 PT (context exhausted; resume here)

**VOICE P0: DONE AND PROVEN.** Root cause was product-wide: web calls carry the session
token at call.assistantOverrides.metadata; our resolver checked call.metadata only, so
EVERY voice webhook event was dropped as unattributable (no voice transcript ever
stored; opener never persisted; text fallback re-greeted). Fixed at all resolution
points + client mic watchdog (local-speech-but-no-transcript banner, one-click text
switch) + merged bubbles + display number normalization + test-mode back link.
PROOF ON PROD (exact VAPI shapes, session VsjNKhAf…): webhook stored both roles;
custom-LLM replied to "I work on sales…" with a real episode probe; by-token transcript
carries both rows + test_mode + back path. Deployed (Railway SUCCESS + Vercel).
CAVEAT: Kaan's own mic never reached VAPI (env-side); the watchdog now surfaces it
in-call. His next Hear-it-live attempt is the human confirmation.

**RESUME QUEUE (overnight mandate, in order):**
1. Task #26 remainder: logo→home + clickable breadcrumbs (AppShell; test-back DONE).
2. Task #27 voice cards: verify click-to-select on prod (Kaan says dead — check the
   absolute-inset selection button z-order vs the new badge), restore provider-hosted
   sample clips w/ 'provider sample' microcopy (Deepgram Aura-2 sample URLs were
   _SAMPLE https://static.deepgram.com/examples/Aura-2-{voice}.wav — restore via the
   manifest as provider fallbacks, ElevenLabs library preview URLs if findable),
   auto-swap on ELEVENLABS_API_KEY.
3. Task #28 Simulations page: serve round history (proof-matrix data: 14/16 r1,
   13/16+1trap r2) + five-persona cast + plain-language explainer; Run button PROPOSED.
4. Continuous stranger bug-hunt (browser walks + suites) until limits. No new features.
5. docs/FOR-EMRE.md WRITTEN — review/polish only if Emre feedback arrives.
Check docs/FEEDBACK-QUEUE.md at every boundary. All work through 79b726f+ committed;
nothing uncommitted at park.

---

# AUDIT SHIFT — July 7 night (premium SaaS audit, Kaan's evening mandate)

Three-persona prod walk → docs/PREMIUM-AUDIT.md (ranked, screenshot evidence in
docs/audit-screens/) → fixes top-down → docs/WHAT-CHANGED-TONIGHT.md (Kaan's return
briefing — READ THAT FIRST).

**AUDIT VERDICTS:**
- P0-1 plan gate: nexus_check wired as a real job (was seeded-but-never-run since 0001;
  Approve 409'd — reproduced on prod pre-fix). BUILT ✓ 6 new tests, backend 147p/1s.
  Prod backfill ran: 4 stuck plans → 3 AWAITING_APPROVAL + 1 honest RETURN with real
  flags (never-collision + numeric-scale catch). Verified in browser post-deploy.
- P0-2 consent promise aligned to Emre-primary. ✓ drift guard 9/9, verified live.
- P1-3 "Hear it live" voice test (0015 voice_test kind, firewalled at compile+screen).
  ✓ 2 tests + live mint verified (kind checked in DB, consent page opened).
- P1-4 scraped-only honesty · P1-5 8 stale sessions expired (Emre invite kept) +
  expired hidden · P2-6 evidence links · queue P2 modal centering (framer transform
  clobber) + P3 end-of-list signal (marked 79b726f). All ✓ tsc/lint/47/47.
- Migrations 0015 hand-applied; Railway api+worker SUCCESS; Vercel Ready ×2.
- FEEDBACK-QUEUE: 2 items pulled + landed at boundaries; empty at shift end.

---

# VERDICT SHIFT — July 7 evening (Kaan's taste verdicts 1-10 + P1 batches, A26/A27)

**AUDIT VERDICTS (A23, one line each; all committed + pushed):**
- P1 jargon (v5): eval-harness ws is_internal on PROD (it WAS in the picker) + code fix;
  Simulations copy client-language; Knowledge Base → Company Context. ✓ tsc/lint/43
- P1 discoverability (v6): New interview primary button on Interviews → /plans?new=1,
  door lands open. ✓
- P1 copy: founder-voiced upload placeholder (pain+name+belief, fictional). ✓
- v1 anonymity Emre-primary (flat promise; naming respondent-initiated only) across
  prompt + all 3 opener copies + evals (fixed suite 10/10, new wants-credit case). ✓
- v3 opener speed 1.07 (no per-message TTS on VAPI) PATCHed+verified. NEAR-MISS: a
  secretless provision run stripped live auth headers ~3 min; restored, script now
  refuses without VOICE_SHARED_SECRET. ✓
- v4 artifact push softened (no-pressure fallback, last-one-you-did anchor). ✓
- v2 tea-break v1: deterministic fade detector (attention.py, 2-signal rule,
  personality guard) + one natural-language offer, shared once-max flag. ✓ 6/6, 133p
- KAAN TASTE VETO (final): "normal day / day-to-day work" opening question BANNED;
  Emre's form live everywhere + assistants re-PATCHed + fetch-verified. HELD for Kaan:
  descriptive "day to day" in the intro sentence (watchtower asking; drop is one edit).
- Voice previews: stock clips BANNED (ClearPath leak); manifest-driven own-register
  clips (generate_voice_previews.py; needs ELEVENLABS/DEEPGRAM keys), honest
  "Preview unavailable" badge meanwhile. ✓ test re-pinned
- P1-A low-context plan competence (A27 delta method) + C questions-always + D approve
  gate + E SOP dimensions + B Refine Plan panel LIVE (audited change log, dead chip
  killed). ✓ plan_runner thin-context 2/2, refine+plan tests 10/10
- v7 Fireflies import + speaker mapping (labels-only rewrite; CEO pick feeds compiler).
  ✓ LIVE smoke: 5 real meetings, Kaan+Emre transcript fetched. backend 139p
- v8 demo transcript generator: kind='demo', provenance.synthetic STRUCTURAL, Example
  CEO entity (real contact never minted), Synthetic chip in Company Context. ✓ 3/3
- v9 coverage_routing stays OFF (round 3 pending) · v10 voice admin-per-workspace, no
  respondent choice · diagrams+naming deferred.
- Protocol: docs/FEEDBACK-QUEUE.md checked at every boundary (empty at each check).
- Migrations 0014 applied to live Supabase. FINAL DEPLOY ✓ (Railway api+worker SUCCESS,
  Vercel Production Ready). PROD SMOKE ✓: health ok · picker clean (no eval-harness) ·
  Fireflies route live (15 real meetings) · demo-transcript route deployed (honest 404
  shape check). FEEDBACK-QUEUE checked at final boundary: empty.

**OPEN FOR KAAN/EMRE after this shift:** descriptive "day to day" in the opener intro
(held for Kaan's word; one-line drop if banned) · ELEVENLABS/DEEPGRAM keys to actually
generate preview clips (script ready) · MERGE-PACKET ⚑ items that survive the verdicts:
flatter-2d judge ruling (Emre) · consent-line partial-compile copy (Kaan) · Tier-3 pass
(Emre+Kaan). Matrix round 3 still next in queue (EVAL_MODE staging holds; note arm B now
carries two-strike escape + tea-break nudge — log as arm-B build delta in proof-matrix).

---

# MERGE SHIFT — July 7 late afternoon (A24 Emre merge, A23 rhythm)

Fully autonomous (Kaan left ~4:25p). Board: merge tasks 1-5, then the 3 product asks.

**AUDIT VERDICTS (one line per landed task):**
- Merge 1/5 fixed responses (e4b71ad): BUILT ✓ evals 9/9 fixed suite + 11/12 taxonomy
  (flatter-2d = pre-existing flake, proven on pre-edit prompt 1/3 vs post 1/3; packet item).
  Prod deploy rides the batch seam after merge 4/5 (prompt+eval layer deploys together).
- Merge 2/5 two-strike + scope lock: BUILT ✓ navigator suite 4/4 (incl. thinness-guard
  case) + test_coverage 6/6. Coverage directive two-strike escape = dormant seat, arm-B note.
- Merge 3/5 sealed flags: BUILT ✓ test_disclosure 6/6, full backend 117p/1s, live smoke
  3/3 (Tier-1 vent correctly NOT flagged). Migration 0011 needs hand-apply at deploy seam.
  Tier-3 = stub only, OPEN as Emre marked.
- Merge 4/5 playbook + yield: BUILT ✓ test_yield_stats 4/4, backend 121p/1s, FULL tuning
  evals 40/40 (taxonomy+whatif+fixed+navigator).
- Merge 5/5 stage-3 hooks + packet: BUILT ✓ test_people_map 4/4, backend 125p/1s.
  MERGE-PACKET.md = per-delta classification; 5 ⚑ items for Kaan+Emre. MERGE_PLAN A25.
- Product asks (Kaan x3): BUILT ✓ custom interview door (goal → mission, gate intact) ·
  add-transcript-later (AddTranscriptDoor, append mode) · context chat (cited Q&A +
  add-as-context). tsc/lint clean, frontend 43/43, backend 127p/1s.
- DEPLOY: migrations 0011-0013 hand-applied to live Supabase (verified: table, column,
  constraint, agent seed). Railway api+worker SUCCESS 23:56Z; Vercel production Ready.
  PROD SMOKE ✓: admin login 200 · 3 workspaces · /plans/generate accepts goal (honest
  404 on bogus ws) · context chat live on bee-goddess-demo (7 CLAIMED citations, real
  answer). Frontend SSR surfaces verified by tests+tsc; browser login walk = optional
  morning nicety.

**FOR KAAN+EMRE (the ⚑ batch, full detail in docs/emre-inbox/MERGE-PACKET.md):**
anonymity-script wording nod (Emre) · flatter-2d judge-vs-venter-bridge ruling (Emre) ·
consent-line partial-compile copy (Kaan taste) · Tier-3 protocol pass (Emre+Kaan) ·
tea-break concept (Kaan). Matrix round 3 (arm A finish + arm B) remains next in queue —
prod staging still holds (EVAL_MODE=1, eval-runner admin); NOTE: arm B now includes the
two-strike escape clause in the coverage directive (logged, deliberate).

---

# Sprint state — DAY FINAL TRUTH, July 6 2026 (parked ~23:00 PT)

## ★ FIRST THING KAAN DOES: THE VOICE CASTING CALL (call all 4, your ears pick) ★

Kaan's test call felt robotic + slow (esp opener). Root cause found: the opener was
MODEL-GENERATED live at call start (firstMessageMode). Fix in ALL 4: static canned
opener (instant TTS) + response delay cut 2.5s → 0.5s + faster interrupt. Four prod links,
each a DISTINCT premium voice (verified live: 4 distinct pinned assistants, all pages 200):

- CASTING-A (ElevenLabs warm FEMALE "sarah", turbo v2.5): https://nexus-v2-alpha.vercel.app/i/TseL3gZCmaTchjIRY_bLq9Y5EXgT4XDv
- CASTING-B (ElevenLabs warm MALE "ryan", turbo v2.5):    https://nexus-v2-alpha.vercel.app/i/8xUwo4ENDOQEawOPT1iBlvp1eIQAfdVd
- CASTING-C (Cartesia sonic-2):                           https://nexus-v2-alpha.vercel.app/i/nQ5yTWzFi20UhN6GkHpCLO72EAUxypUQ
- CASTING-D (Deepgram Aura "asteria" — CONTROL, current default voice + same timing fixes): https://nexus-v2-alpha.vercel.app/i/dT4tN9h5kaiD0mbn3ZJzSj0PEY0wjd-V

(Voices PATCHed in place, so tokens/links above are FINAL and unchanged. All 4 carry:
firstMessageMode "assistant-speaks-first" + canned opener, startSpeakingPlan waitSeconds 0.4
livekit smart-endpoint, stopSpeakingPlan numWords 0. A/B: eleven_turbo_v2_5, stability 0.45 /
similarityBoost 0.75 / speakerBoost / optimizeStreamingLatency 3. Two minor swap-if-wanted
notes: Cartesia-C voiceId is VAPI-accepted but not dashboard-confirmed as the warmest pick
(one PATCH swaps it, no re-mint); opener text is a consistent static warm line, not doc §2's
exact wording. Neither blocks the bake-off — voice is the variable, opener is held constant.)

D is the control on purpose: if D already sounds human, the timing/opener fix ALONE fixed
it (no provider change needed); if A/B/C clearly beat D, we upgrade voice tier.
ALL 4 CONNECTION-TESTED on prod (audit-eng, reached "You're connected" in the live orb room,
0 errors). LATENCY finding for the bake-off: A/B/D connect to first audio in ~7-9s; CARTESIA
(C) is SLOWER, ~16s handshake — factor that if judging "feels snappy." NOTE: the 4 sessions
were connection-tested then RESET IN PLACE to pristine pending (utterances cleared, pins kept),
so Kaan hits each voice FRESH FROM THE OPENER — critical since opener velocity is what he's
judging. FINAL: these 4 links ARE the deliverable, verified pristine + working. Call as-is. The consent
page greets "Burak" (sessions reuse Burak's plan for content — cosmetic, fine for a bake-off;
call from a phone/real mic, the orb reacts to the voice). Winner → editor default = next
session (one --build re-run). Research + recipe rationale: docs/VOICE-RESEARCH.md. Our VAPI
key CONFIRMED supports ElevenLabs + Cartesia + Rime (tested live). voice-room's curated
picks can swap in via one idempotent re-run if you want different voices.

## KAAN DECISION LIST (consolidated — everything waiting on you)
1. ~~Voice casting winner~~ RESOLVED July 7: Kaan picked CASTING-B (ElevenLabs "ryan" +
   timing fixes). Set as the GLOBAL DEFAULT for all workspaces (both shared default VAPI
   assistants PATCHed to the ryan recipe; resolver metadata + tests updated; MERGE_PLAN A20).
   Live + verified on prod (uncustomized workspace reports ryan/M, fast opener). Cleanup of
   the 4 casting assistants/sessions is the remaining next-session tidy.
2. **A19 redesign** — drop the reference mock PNGs into reference/ui-inspo/ to unblock the
   dark-orb room / Observer view / tabbed Voice Settings build (staged in MERGE_PLAN A19).
3. **Speed slider** — swap to a speed-capable provider or drop from the A19 mock (A19 pass
   tests whether VAPI honors an Aura speed override).
4. **Picker hero ordering** — pure recency (shipped, empty real tenant can lead) vs
   newest-PREPARED (content leads); one-line switch staged in page.tsx (audit-eng holds it).
5. **Picker contents** — prune to Bee Goddess for demos, or keep example workspaces.
6. **Emre ratifications** (morning packet): F21 same-speaker-retraction (staged patch,
   1 command), F42 halo (2/3 multi-turn evidence), F38+ batch.
7. Earlier taste batch (voice roster confirm, badge labels), morning-review packet.

## MORNING ITEMS (non-blocking, logged for next session)
- Aurora tenant: 1 record / 0 cards renders an empty snapshot with NO upload affordance
  (mild dead-end for that in-between state); pristine 0-record empty state is fine.
- Casting cleanup: 4 casting VAPI assistants + 4 pinned sessions on bee-goddess-demo live;
  clean up (delete assistants / expire sessions) after Kaan picks the winner.
- Tenant-scoping (auth is identity-only — any admin reads any workspace); job-poll
  unification; router _loads shim sweep; NO_RESPONSE reminder scheduler; API-shape
  consolidation; harness-on-prod admin creds env (NEXUS_ADMIN_EMAIL/PASSWORD). All in YC-AUDIT.md.

## PROD STATE (all live, smoke-verified)
HEAD 644e747 deployed (Railway api+worker + Vercel). Auth enforced (Supabase JWT on all
/api/* except token+voice routes). Migrations 0001-0009 applied to live (0008/0009 by hand,
statement_cache_size=0 for the pooler). auth.users clean: Kaan + Emre + admin@nexus.app only.
Demo login: admin@nexus.app / Nx-7bhUhOeIy4DP746f (rotated). Kaan: taskentbusiness@gmail.com
/ Nx-6-MeUIdoGNUsrH45. THREE sprints shipped today: V2 product+auth (morning), YC-audit
hardening (evening workshop — API auth P0 + trust-surface fixes), Sprint-2 voice+multi-company.

---

# Sprint state — V2 FINAL + evening workshop + Sprint-2 (voice/multi-company), July 6

## SPRINT-2 — PROD DEPLOYED at a9e4e9b (~21:30 PT), smoke-green

Three lanes, shipped + deployed + smoke-verified:
- **Lane A (de-Burak + multi-company):** no demo tenant hardcoded in any code path;
  2 cosmetic leaks fixed (AddCompany placeholder, DiscoveryUpload sample transcript);
  picker reordered by recency (demo no longer permanent hero) + honest empty-hero.
  Full stranger-walk E2E proven on a fresh A12-clean tenant (Northwind: 10 records, 8
  accurate company-specific cards, plan-gen worked). Northwind hidden via is_internal
  (reversible, audited). Resting picker = Bee Goddess + Aurora.
- **Lane B (voice settings):** migration 0009 voice_configs + admin GET/PUT
  /api/voice-config/{ws} (require_admin) + PUBLIC by-token resolver. Customizing a
  workspace provisions its OWN dedicated VAPI assistant server-side (private key never
  in browser; A12 isolation — never mutates shared asteria/orion). Config saves first,
  VAPI push best-effort w/ honest vapi_synced/sync_error. Settings page /w/[slug]/settings
  + nav link, 10 warm Aura-2 voices w/ real preview clips, gender filter. Dead speed
  slider REMOVED (Aura has no speed param — every-button-works; plumbing dormant for a
  future speed-capable provider). getCallVoice wires the live call to the workspace's
  assistant w/ asteria fallback.
- **Lane C (live interview room):** raw-WebGL audio-reactive glass orb (no three.js dep),
  live transcript, A18-NEUTRAL progress (time + process state, NO claims ticker; coverage
  prop left undefined — no honest live signal). Verified in isolation + composed in the
  real app. Live-VAPI-call confirmation on prod = in flight.

**DEPLOY NOTE (caught by smoke):** migration 0009 was NOT on live Supabase — voice-config
route 500'd; applied by hand (statement_cache_size=0 for the pooler), now 200 w/ roster.
Same hand-apply-migrations gotcha as 0008; always smoke a route that hits the new table.

**A19 — NEXT BUILD PASS (Kaan's design verdict, staged in MERGE_PLAN A19 + 6656fcf).**
Reference mock set: dark particle-orb room, Observer view (insight cards + topics ring),
tabbed Voice Settings. Tonight shipped the A18-neutral v1 foundation (no live-insight
badges = no correction-#1 surface); A19 is v2. FOUR mandatory corrections captured, one
BINDING guardrail: live-insight trust badges MUST map through the real ladder (trust.ts +
ConfidenceBadge), never all-Verified — a live single-source claim is Reported at most,
tags never upgrade in-the-moment. audit-eng reviews that mapping before Observer ships.

**KAAN DECISIONS OPEN (Sprint-2):** (1) drop Lane B/C reference PNGs into
reference/ui-inspo/ to unblock the A19 compare-loop · (2) speed slider: swap to a
speed-capable voice provider, or drop speed from the mock (test whether VAPI honors an
Aura speed override in the A19 pass) · (3) voice roster listen-session (A11.4; default =
10 warm Aura-2) · (4) picker contents + hero ordering for client demos: prune to Bee
Goddess or keep example workspaces; AND pure-recency (shipped — an empty real tenant like
Aurora can lead) vs newest-PREPARED (content leads, demo displaced by any newer populated
workspace) — one-line switch staged, audit-eng holds it. Plus the earlier-shift items
(Emre ratifications, morning packet).

## EVENING WORKSHOP (YC audit) — PARKED CLEAN, PROD REDEPLOYED at 76aab67 (~19:51 PT)

Kaan's 2-hour order executed in ~45 min of build: four-lens YC audit (docs/YC-AUDIT.md,
ranked top-15) then fix-downward. **Shipped + deployed + smoke-verified tonight:**
- **#1 P0 API AUTH CLOSED**: Supabase JWT verified on all admin routes (GoTrue
  introspection, fail-closed, TTL cache); api.ts bearer + live/live-server RSC split;
  harness authenticates for real (evals/harness/auth.py, needs NEXUS_ADMIN_EMAIL/PASSWORD
  env). Smoke on prod: unauth 401 / real-token 200 / by-token still public. FOR-TUNC #21.
- **Trust cluster**: role-level attribution default on pains/open-questions (names behind
  a release flag), consent + done screen name the audience (EN+TR), future-tense review
  promise replaced with honest present, "CEO vs floor" → "Leadership and floor view",
  "Admissions Worth Chasing" → "Open Questions", perception-gap tile counts the real gaps.
- **Plan lifecycle reconciled**: session complete/compile now advances plan state
  (forward-only, idempotent); ONE terminal word "Completed"; naming sweep (breadcrumbs
  derive from nav labels); Plans board reconciles with Interviews (plan-less completions
  surface; duplicate plans dated).
- **Visual P0**: step-rail edge fade on Report + Editor (no more mid-word clips);
  opt-in "Trust:" prefix on Snapshot pills (FOR-TUNC #20, Kaan veto); micro-batch
  (contiguous numbers, founder dedup, "Not captured" slots, SOP style guard).
- **#33 generate-plan button** (job-backed honest progress) + global jsonb codec.
- All suites green at deploy (backend 92, frontend 27, tsc/lint clean).
  Demo password ROTATED post-workshop (old one had touched git history).

**TOMORROW (ranked remainder, from YC-AUDIT "tomorrow" section):** tenant-scoping by
claims (auth is identity-only — any admin reads any workspace) · job-poll unification
(one /api/jobs/{id} + one hook) · router _loads shim sweep (5 min, post-auth) · API URL
shape consolidation · NO_RESPONSE reminder scheduler · compile-side F21/F34 release flow
(EMRE) · comparator patch landing (staged, EMRE ratifies) · #18 full-chain finale on prod
(harness now needs admin creds env) · structural inventory model · aurora-atelier tenant
still unclaimed (hide after Kaan confirms not his) · ~~plans/page.tsx re-point~~ (done,
dce70f7, deployed + SSR-auth smoke passed) · backfill legacy plan states (reconcile fix is
forward-only; Burak's pre-existing row still reads "Sent" beside its report — one UPDATE
or on-read reconcile). Morning packet §7 has the Kaan/Emre summary.

---


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

## July 7 PARK NOTE v2 — EMRE DELIVERED, merge preempts everything (resume here)

**HARD-PARKED ~12:30 PT at 95% context; repo clean at a80fa1d.** Emre voice link
(fresh, pristine, verified): https://nexus-v2-alpha.vercel.app/i/CH7Zt-Y05gzhkkt_y4UwYvAQTQAtxlbT
(the earlier Np2252 link was consumed by Kaan's 10:02 test call — session b38cc71a, 1 turn,
harmless, ignore or clean). Merge tasks #6-#11 all PENDING, none started — the fresh
session begins at #6 after reading A24 + the inbox. EVAL_MODE=1 still live on nexus-api
(documented, A12-safe) for the P2 matrix resume; restore to 0 if the matrix gets deferred.

**FIRST ACTION on resume:** `git pull` then read docs/emre-inbox/ (watchtower commits
stage-7-interview-agent-draft1 + stage-3-ceo-call-v04 text copies, ~12:15 PT). The merge
work order is captured as session tasks #6-#11 (fixed-response layer+evals · two-strike +
scope lock · sealed-flags Tier-2 table + Tier-3 STUB ONLY · six-type playbook + yield
outputs · stage-3 hooks + CONFLICT PACKET · Kaan's 3 product asks verify-then-build).
Protocol REFINED by Kaan (A24 — read it first): ADOPT/CONVERGENT/CONFLICT/OPEN per delta, tested build wins by default, reasoning always logged;
Tier-3 stays open pending Emre's dedicated pass. A23 rhythm binds each piece.
Matrix round 3 resume (below) moves to SECOND priority — its prod staging still holds.

## July 7 PARK NOTE — session context exhausted mid-queue (resume here)

**Rhythm:** A23 (BUILD→AUDIT→NEXT) live in CLAUDE.md + MERGE_PLAN (12765cd).
**Done today + audited:** A20 voice (ryan default, full opener arc, VAPI-verified) ·
A21 Emre-readiness sprint (gate PASSED, all six targets live on prod) · A22 watchlist
cuts · runbook Act-2 dry-run + text fixes (d005ba2) · Apify degradation confirmed +
unit economics table (1c08ba2: $0.22/interview avg, $0.29/full cycle, ~70 cycles per $20).

**IN FLIGHT — matrix round 3 (resume first):** Anthropic credits RESTORED and verified.
Prod is READY for the run: EVAL_MODE=1 is LIVE on nexus-api (double-gated, A12-safe;
set 12:05ish PT) and eval admin eval-runner@nexus.test exists (password in the session
scratchpad; recreate via create_admin.py --reset if lost). Next actions, exactly:
(1) finish arm A: agency-account-manager + warehouse-foreman via
    `python -m evals.harness.respondent_sim --persona X --turns 14 --json evals/e2e/runs/r3A-X.json`
    (NEXUS_APP_BASE_URL=prod, NEXUS_ADMIN_EMAIL/PASSWORD set; ≤2 concurrent — 5-way timed out);
(2) arm B: `railway variables --set COVERAGE_ROUTING=1 --service nexus-api`, rerun all 5 → r3B-*;
(3) restore: COVERAGE_ROUTING unset + EVAL_MODE=0, delete eval-runner admin;
(4) evidence table into proof-matrix.md §Round 3 + one-line audit verdict here.
Arm A partials committed (30639a1): bookkeeper reproduced h-bk-3 gap at baseline.

**Queue after (Kaan-confirmed, A23 rhythm binds):** (1) runbook Act-1 live-compile
dry-run (now unblocked by credits) + fix friction; (2) deep-health endpoint (failed-jobs
count + last-error age, honest, no vendors); (3) copy-invite-link button w/ sent-state +
admin "Try it yourself" throwaway-session button; (4) fresh-eyes bug sweep on two
workspaces; (5) naming proposal table for Kaan. Emre docs merge PREEMPTS all on landing.

## July 7 afternoon — Apify degradation + unit economics (closes production-gap item 8)

**Apify balance exhausted — graceful degradation CONFIRMED (code-verified, no live calls
made, no retries burned):** `apify_linkedin_people` catches every failure, logs a server
warning, returns None; recon coerces to an empty people pool, writes no linkedin_people
source row, and proceeds website-only. Nothing surfaces to clients — people suggestions
fall back to call-discovered chips (exactly what Bee Goddess shows live). Apify is only
attempted when a linkedin actor_id is supplied, one sync call, no retry loop.

**Unit economics from prod agent_runs (171 runs, all claude-sonnet-4-6 @ $3/$15 per MTok
input/output; measured July 7):**

| Unit | n | avg cost | p90 cost | avg runs | avg tokens |
|---|---|---|---|---|---|
| Interview cycle (session-linked runs) | 18 | $0.22 | $0.48 | 8 | 62,334 |
| Compile (null-session runs, 15-min clusters) | 7 | $0.07 | $0.10 | 3 | 10,998 |
| Full cycle (interview + compile) | — | $0.29 | ~$0.58 | — | — |

**Kaan's $20 buys ~70 full cycles at average usage (~34 at p90), or ~91 interviews /
~298 compiles taken alone.** Caveats: agent_runs counts our audited seats only (VAPI
voice minutes and Deepgram transcription bill separately on VAPI's side; OpenAI
embeddings separately); no prompt caching is currently measured in these numbers, so
real costs can only come in at-or-below this. Compile clustering is a 15-minute-gap
heuristic over null-session runs.

**OPEN QUESTIONS / KAAN DECISIONS:**
- aurora-atelier tenant visible in prod picker — unclaimed by any lane at park time; if
  not Kaan's own Act-1 test, hide via is_internal like the QA tenant. DO NOT delete.
- Emre ratifications (evidence pre-loaded): F21 same-speaker-retraction (staged patch);
  F42 halo (2/3 multi-turn baseline); F38+ batch. Packet §4-§6.
- Emre batch addition (July 7, from the A21 gate walk): the interviewer's own GENERATED
  speech produced an em-dash mid-conversation. The no-em-dash rule binds authored UI copy
  today; extending it to the persona prompt (stage7-interviewer) is Emre's call — flag
  alongside his opener-wording pass (A20 opener restoration is EMRE-SEAM).
- Kaan taste batch: coverage_routing feel change (OFF until nod) · 4 em-dash records on
  bee-goddess-demo (ruled documented+deferred-to-reseed; Kaan may override for a cosmetic
  one-time edit) · demo account address (admin@nexus.app) · voice-selection session.
- Kaan+Emre personal admin logins created and verified (creds relayed in chat ~10:05 PT).

**MORNING (Kaan, unchanged):** open prod · FIRST VOICE CALL (voice-modality interview from
Burak's plan) · morning-review packet (blind golden labeling, Q1-Q3, F38+ proposals) ·
taste veto batch · Artifact (V2 section).
