# YC Audit — what stops Nexus from being a Y Combinator product

*Evening workshop, July 6. Four lenses, 25-minute timeboxes: product coherence, psychology
(vs our own corpus), taste, engineering consistency. Full per-lens evidence lives in the
audit scratchpads; this is the merged, ranked verdict. Severity: P0 = blocks a sale or
breaks trust · P1 = embarrassing in front of a buyer/Emre · P2 = polish. `[EMRE-SEAM]` =
his stage 3/6/7 docs (due ~12h) would refine the answer; fixes leave the seam clean.*

**Headline verdict:** the interviewer persona and the copy are above the bar (the persona
is genuinely well-defended; the copy has no AI tells). What stops the YC pitch today:
(1) the API trusts anyone, (2) we make respondents trust promises the system does not
enforce, (3) the flagship metric reads zero on screen while the presenter narrates it,
(4) the flagship visual clips mid-word. All four are fixable tonight.

---

## The ranked fifteen

### 1. [P0] The backend has no authentication — FIX IN FLIGHT (#37)
**Lens:** engineering. **Evidence:** `main.py:24-38` mounts only CORS; `api.ts:12` sends no
bearer; only voice callbacks are secret-gated. Anyone with a workspace UUID reads every
claim/snapshot/transcript AND can call `POST /api/plans/{id}/send`, which mints interviewee
tokens. Non-negotiable #3 (nothing reaches employees without the human gate) is enforced in
UI only. **Fix:** FastAPI dependency verifying the Supabase JWT on all `/api/*` except
interview-token + voice routes; harness authenticates for real. *(audit-eng, running)*

### 2. [P0] The respondent review promise is unbacked and silently skippable
**Lens:** psychology. **Evidence:** consent + done screen promise "you'll get to review
anything attributed to you by name before it's shared" (`InterviewClient.tsx:176-178`,
`respondent.ts:130`), but `/complete` (`sessions.py:103-117`) compiles with no review gate,
no async review surface exists anywhere, and the only real mechanism (the conversational
reflect-back close) is bypassable via the Finish button. We describe a mechanism we did not
build, at the exact trust-defining moment. **Fix (collapses #3 below too):** enforce
role-level/de-attributed rendering as the default — names never surface to the founder
without an explicit release — and fix the done-screen tense to describe what actually
happened. Structural compile-level default is `[EMRE-SEAM]` (F21/F34); render-level default
ships tonight.

### 3. [P1] Pains and "admissions" render employee NAMES to the founder
**Lens:** psychology. **Evidence:** `InsightsView.tsx:196-218` renders `speaker` full names
beside pain points and admissions; the persona promises role-level default ("someone in
packing", `reflect-back-close.md:28`, hard rule 8). Broken promise + person-sentiment
adjacency (non-negotiable 4). **Fix:** role-only display on these cards, name gated behind
an explicit release flag. `[EMRE-SEAM]`

### 4. [P0] Consent never names the audience
**Lens:** psychology. **Evidence:** "shared" appears throughout consent/invite
(`consent-landing.md:25-28`, `respondent.ts:128-133`) but never "with whom" — while the
invite says the boss commissioned it and the report is admin-only, facts the respondent
never sees. The anxious operator's load-bearing question ("does my manager read this?")
goes unanswered at the consent moment. **Fix:** one honest line naming the audience and the
de-attribution default. `[EMRE-SEAM stage 3]`

### 5. [P0] Workflow step-rail hard-cuts cards mid-word on the flagship surfaces
**Lens:** taste. **Evidence:** "Prevent boutiques f", "WhatsApp group" clipped at the panel
edge on Report (`ReportView.tsx:114`) and Editor (`WorkflowEditor.tsx:190`) — `overflow-x-auto`
with no edge treatment; reads broken, not scrollable. DESIGN-V2 §4.8 already specs the fade.
**Fix:** right-edge gradient mask + next-card peek + no mid-word clip.

### 6. [P1, flirts with P0] "Perception gaps: 0" renders beside a live perception gap
**Lens:** product. **Evidence:** Insights stats `{conflicts:5, gaps:0}`; the flagship
yıldırım gap is `kind=ceo_vs_floor`, counted as a Conflict Point, never as a gap. A YC
partner watching a "we surface perception gaps" pitch sees the counter say zero.
**Fix:** count `ceo_vs_floor` conflicts in the gap tile, or merge the two concepts on
screen. (Comparator eligibility itself is the separately staged Emre patch.)

### 7. [P1] Same interview: "Completed" on one screen, "Sent" on another
**Lens:** product + engineering (same root). **Evidence:** Burak's session is completed with
a report; his plan chip reads "Sent" with a "View report" link beside it. Root: 7 of 12 plan
states have no writer (`plans.py:55-67`); session completion never advances the plan
(`sessions.py:112`). **Fix:** drive plan transitions from session complete/compile; delete
or wire the dead tail states (NO_RESPONSE reminder loop has no scheduler — log for
tomorrow).

### 8. [P1] "CEO vs floor" is an adversarial label on the founder's own gap
**Lens:** psychology. **Evidence:** `conflicts.ts:6` + bold "vs" chip; casts the proud
founder as combatant against his workers, contradicting our de-personalized F41 stance and
the collaborative framing three lines above it. **Fix:** relabel ("Leadership view and
floor account" / reuse "Perception gap"), soften the chip. `[EMRE-SEAM stage 6]`

### 9. [P1] "Admissions Worth Chasing" frames honesty as confession
**Lens:** psychology. **Evidence:** `InsightsView.tsx:89` — an honest "I don't know",
named, read by the founder. Judges the person, not the work. **Fix:** rename ("Open
Questions") + role-level per #3.

### 10. [P1] Interviews and Plans don't reconcile
**Lens:** product. **Evidence:** Ece completed with a report but has no plan row; Selin
appears twice (NEXUS_CHECK + DRAFT) undisambiguated. What Interviews shows, Plans can't
find. **Fix:** every completed interview reachable from Plans; label/collapse duplicate
per-person plans.

### 11. [P1] jsonb leaks as raw strings on bare-dict list endpoints
**Lens:** engineering. **Evidence:** no asyncpg json codec (`db.py`); `list_plans` and
`list_claims` ship `mission`/`never_list`/`provenance` as strings while every other
endpoint decodes — same field, two shapes. **Fix:** global jsonb codec in `get_pool`.

### 12. [P1] Green trust chip reads "good" on bad-news headlines — KAAN VETO ITEM
**Lens:** taste. **Evidence:** "account nearly lost" + bright green High chip. Semantics
locked (F35/A2) so recoloring is off the table. **Fix:** label differentiation ("Trust:
High" prefix or quiet dot). Logged as a named deviation if applied before Kaan's nod.

### 13. [P2] Naming drift: one concept, four names + breadcrumb/nav disagreements
**Lens:** product. **Evidence:** Interview Plan / Interview Plans / Plans / All plans;
breadcrumb "Knowledge" vs nav "Knowledge Base"; report pages highlight "Interview Plan" in
nav while the crumb says "Report"; "Completed" vs "Compiled" terminal words; opaque "Nexus
check" chip. **Fix:** one noun per concept, breadcrumb from nav labels, parent crumbs on
detail pages, explain-or-rename NEXUS_CHECK.

### 14. [P2] API shape drift: two URL conventions + a route-slot footgun
**Lens:** engineering. **Evidence:** `/api/{entity}/{ws}` vs `/api/workspaces/{ws}/{res}`;
`/api/workflows/{workspace_id}` shares its slot with `{workflow_id}` routes (wrong id
returns `[]`, not 404). Plus 4 job-polling conventions and 3 hand-rolled frontend pollers
(despite one jobs table), and `_loads` duplicated 4x. **Fix (tomorrow-sized):** nest under
`/api/workspaces/`, one `GET /api/jobs/{id}` + one enqueue envelope + one poll hook.

### 15. [P2] Sparse-surface and micro-hygiene batch
**Lens:** taste + product + psychology. Ranking numbers leak (2, 4) on Areas cards ·
"Founder (Founder)" name==role duplication · Plans page is one card in a void · Blueprint
slot-grid reads as a field of "—" · consent-page reassurance repeated 3x on the chat
surface (skeptical-foreman over-soothing) · faux "typing…" dots (taste call for Kaan) ·
preventive style rule for generated SOP/report prose (guard the NEXT AI-tells beyond
em-dashes). Each is a one-line fix; batch them.

---

## What's already above the bar (so we don't fix what isn't broken)
Interviewer persona: anti-sycophancy, role-level pain default, redact-at-close, no leak
toward respondents — coherent and defended. Copy: human-grade, no AI tells (invite,
consent, empty states, insights framing). Trust/conflict labels centralized with tests.
Insights + Knowledge Base visuals at the target tier. Honest failure states throughout.
Paraphrase-not-verbatim reporting (F33/A3). Snapshot compiler honors self-corrections.

## Tonight vs tomorrow
**Tonight (Phase 2, running):** #1 auth · #2/#3/#4 render-level de-attribution + honest
consent/done copy · #5 step-rail fade · #6 gap counter · #7 plan-state advance · #8/#9
relabels · #11 codec · #12 chip label (flagged) · #15 quick batch.
**Tomorrow / Emre-gated:** structural compile-level de-attribution + release flow (F21/F34)
· comparator patch landing (staged, awaiting ratification) · #10 inventory model ·
#14 API-shape consolidation · NO_RESPONSE reminder scheduler · voice-call live test.

## Ops notes
`aurora-atelier` = unclaimed tenant on prod (runbook example name); hide-don't-delete
pending Kaan's confirmation it isn't his. The QA probe tenant creation was skipped
(browser contention); qa's earlier acceptance tenant covers it.
