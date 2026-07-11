# NIGHT ORDERS — July 10 overnight: AUDIT + FIX. Goes live tomorrow.

You are the night session. One session, whole repo, no lanes tonight. Kaan's orders verbatim
are in §1; Emre's round-2 addendum (read it FULLY, including both transcripts) is at
`docs/emre-inbox/round-2-addendum.md`. Watchtower monitors commits + prod and will
independently verify — do not self-certify.

Persona for judgment calls: senior engineer with clinical-psychology/neuropsych depth,
reads people like Patrick Jane, thinks like a top-tier consultant. Every fix judged by:
does this make Nexus feel MORE PERCEPTIVE, MORE TRUSTWORTHY, FASTER?

## 1. KAAN'S ORDERS (verbatim, binding)

Phase 1 — AUDIT (before writing any code):
1. Map the codebase. Identify dead code, unused files, duplicate logic, abandoned features. List with file paths.
2. Cross-reference Emre's feedback docs AND the last 3 days of session feedback against actual code. Build a gap list: requested vs actually shipped. "Significant chunks were acknowledged but never implemented. Assume nothing is done until you verify it in the code."
3. Profile performance. Find slow paths (API calls, redundant LLM calls, blocking ops, oversized prompts). Find token waste — API cost is too high.
4. Answer before implementing: What is dead vs load-bearing? Which feedback items are quick wins vs structural? Top 3 causes of slowness?

Phase 2 — PLAN: Create `OVERNIGHT_PLAN.md` in the REPO ROOT (canonical name — Kaan reads
this when he wakes up). Prioritized: P0 (broken or promised-and-missing), P1 (performance
and cost), P2 (dead code removal), P3 (polish). Order by impact-to-effort. Update after
EVERY completed item with status and what changed.

Phase 3 — EXECUTE:
- Priority order. Test each fix before moving on. No batching untested changes.
- Cost discipline: reason first, read the code, then act. In the product itself: prompt trimming, caching, model right-sizing.
- No rewriting working systems for style. No architectural adventures tonight.

Commit hygiene (non-negotiable), every commit:
```
fix(scope): short description

Before: [what was broken/happening]
After: [what happens now]
Why: [one line]
```
Small, atomic. Morning history must read like a changelog a stranger could follow.

Success criteria: (1) every Emre round-2 item fixed or deferred-with-reason in
OVERNIGHT_PLAN.md; (2) all last-3-days feedback verified implemented or flagged;
(3) measurable speed improvement on main interview flow, before/after numbers in the plan;
(4) dead code removed, nothing broken (smoke test after each cut); (5) UI/UX everything
working and making sense; (6) Nexus is smarter — can interview any 9-5 professional without
asking them to define their own profession; (7) clean readable commit history.

## 2. THE HEADLINE PROBLEM — Emre's WhatsApp verdict (Kaan + Emre, today)

- Emre: "Nexus needs training. We can't ask a 9-5 salary man to do this interview as is. It needs background knowledge on a BCG level and have heuristics."
- Emre: "No just a lot of stupid questions. Test Mest is a data science/consulting firm and it's asking what's data cleaning for example."
- Kaan: "Maybe like stage 2. It makes hypothesis before going into call. Strong models like gpt 5.5 already know this knowledge."
- Emre: "Schema not hypothesis trust me." Kaan: 👍
- Kaan: "Perhaps it's not putting enough weight. Before going into the call if it prepares to talk to someone in sales — smart models know everything about sales." Emre: "Maybe that's the way."
- Kaan: "System prompt — we should pull it from GitHub and actually read it." Emre: "It already knows it — it probably is being prompted too [naively]."

Emre's addendum §4 gives the measured diagnosis, IN ORDER: (1) stale definition-of-done
(the refine bug, see WS-2 — the "stupid questions" mapped 1:1 onto retired fields);
(2) wrong register pre-read (pleaser playbook applied to an irritable competent data
scientist = condescension; pre-reads must be HYPOTHESES the live conversation can override);
(3) polish (never repeat a source-probe in identical words; irritation = register signal,
shift on the FIRST signal not the third). Control: Berk's session, clean inputs, zero
misfires from the SAME interviewer the SAME night. So: much of "stupid questions" is the
refine bug + bad inputs — fix those first — and the rest is WS-1.

## 3. NAMED WORKSTREAMS

### WS-1 SMART-PREP (P0) — schema-not-hypothesis, BCG-level register
Two parts:
a) **System-prompt audit first** (Kaan explicitly ordered reading it end-to-end). The model
   already knows every business domain; if it asks a data scientist "what's data cleaning,"
   the prompt is suppressing domain competence (capture-discipline over-applied = playing
   dumb). Fix the stance: ASSUME domain competence, verify the company-specific
   instantiation. Never ask a professional to define their profession's basics. Ask like a
   sharp consultant peer: "you're cleaning in Claude with a visual cross-check — what does
   that check actually catch?" not "what is data cleaning?"
b) **Pre-call SCHEMA stage** (Emre: schema, NOT hypothesis). Before the call, from company
   context + role, build a compact industry/role schema: the process areas, tools, and
   table-stakes practices a person in this role at this kind of firm necessarily has.
   Inject as a small prep packet ("industry prime") into the interviewer prompt. Schema =
   what the territory looks like; NOT guesses about this specific company (those become
   leading questions — non-negotiable #2 adjacent). Keep it SMALL — this must not blow up
   token cost (P1 conflicts otherwise).
c) Pre-reads (handling notes, register characterizations like "pleaser") become explicit
   HYPOTHESES: live-conversation evidence overrides them, stated in the prompt.

### WS-2 REFINE-REWRITE (P0) — refine appends instead of rewriting (addendum §3.2)
Refine chat produced a "PLAN REBUILD NOTE" inside handling notes, retiring must-hits 1-8 at
runtime while visible topics/goal/definition-of-done stayed stale. Approval surface no
longer matched effective plan; reviewer validated old topics; stale DoD drove the stupid
questions. FIX: refine must REWRITE the effective package (topics, goal, DoD) with the
audit trail preserved underneath — exactly like workflow edit overlays render an effective
workflow. This is the root cause of §4; do it before or with WS-1.

### WS-3 ENTITY-BLEED (P0) — plan borrows nearest strong entity (addendum §3.1)
Ahmet's plan was drafted with the CEO's job description (due-diligence must-hits, "managing
a team of over thirty" handling note) because records about Ahmet were thin + operator
mission vague. FIX: when records about the named person are thin, the plan SAYS so and asks
the operator, rather than borrowing another entity's material. Control case: Ayse/Berk
plans with specific missions came out clean.

### WS-4 LIST-TRUTH (P0) — interview list state unreliable (addendum §3.4 + §3.5)
- Ahmet's completed session shows "In progress"; Berk's completed interview missing from the list entirely; counters don't match rendered rows; both reports unreachable from the list (record store proves both compiles ran).
- Live "items captured" counter read 0 for Berk's ENTIRE capture-heavy session (respondent-side count — this is the R1 audience-split count surface; it must actually tick).
Both are trust-killers on the surfaces Kaan demos. Find root causes (status transitions,
list query, counter event plumbing), fix, verify against the real Test Mest workspace data.

### WS-5 LOUD-EMPTY-TANK (P0) — credit exhaustion must be a loud, named error (addendum §1)
The July 10 outage failed silently in three costumes (snapshot never composing, plan
drafting hanging, paste-compile erroring). Every AI surface must surface a named
"AI provider credits exhausted / provider error" state instead of hanging or silently
dying. Worker: detect provider 4xx credit/auth errors distinctly, mark jobs with that
named error, surface on admin UI (banner or job-status), not buried in last_error.

### WS-6 DEDUPE-SWEEP (P0, data integrity) — addendum §1
Test Mest jumped 57 → 143 records before either worker interview — repeated compile runs
during the exhaustion window may have duplicated records. Write a dedupe check (same
session_id + same/near-identical claim text), report counts first, then dedupe with a
backup/reversible path. Run on any workspace active in the exhaustion window. CAREFUL:
records are the product; confirm-before-destructive — stage the deletion list in the plan
file, mark it clearly, and only merge duplicates that are exact/provably-same-compile-run.

### WS-7 NEVER-VISIBLE (P0) — NEVER list absent from plan approval surface (addendum §3.3)
Emre could not verify the White Wall exclusion before approving. "The approval gate should
show everything the interviewer will obey, or it is not an approval gate." Render the
NEVER list (and handling notes) on the plan review surface.

### WS-8 SPEED + COST (P1) — Kaan: "the system feels slow", first-class tonight
Profile the main interview flow: turn latency (respondent speaks → agent replies), plan
generation, compile. Look for: redundant LLM calls, oversized prompts (system prompt bloat
feeds both cost AND latency), blocking sequential calls that could parallelize, missing
caching, models oversized for their job (classification/extraction jobs on big models).
Record before/after numbers in OVERNIGHT_PLAN.md. Do not degrade interviewer quality to
win milliseconds — right-size the non-interviewer jobs first.

### WS-9 DEAD-CODE (P2)
Map and cut: unused files, duplicate logic, abandoned experiments from rapid iteration.
Some may be actively confusing (stale prompts/configs still loaded?). After each cut: build
+ test + smoke. Nothing breaks. If unsure whether load-bearing: leave it, list it.

### WS-10 REGISTER-SHIFT (P3 polish, interviewer) — addendum §4 residuals + endnotes
- Never repeat a source-probe in identical words ("rough feel or timed?" asked twice verbatim).
- Respondent irritation = register signal; shift altitude on the FIRST signal, not the third ([A9]).
- Promote the 30-second bus-factor closer from instinct to explicit playbook ([B8] — best material of BOTH sessions).
- [A5] missed-probe: "that's never happened" on a 20-min visual check of 1000+ AI-cleaned rows should get ONE neutral capture-side follow-up ("if it had missed something, how would you know today?").
- [B7] no stacked questions under time pressure (one thread at a time held everywhere except the crisis question).

### WS-11 EVAL-MINE (P3) — R3 standing rule: Emre transcripts are permanent eval sources
Add to the eval suite from the addendum: [A5] missed-probe, [B7] stacked-question-under-
pressure, [A9] first-irritation register shift, identical-words repeat probe. Keep eval
runs FRUGAL — product API credits are limited (topped up $30 this morning, partially
burned). Do not brute-force eval loops.

### WS-12 SMALLS (P3)
- Empty-session compile: `compile_session` (and any utterance-reading handler) NO-OPs gracefully on 0-utterance sessions (watchtower finding, KAAN-RULINGS §post-close; same class as 199ec8c missing-session sweep).
- Send modal re-asserts Voice after Text selected in setup (addendum §3 minor).
- Assign-interview email field does not carry over (addendum §3 minor).
- [B6] conflicts view: Berk's notebook contradiction (secret 12-point checklist vs founder's "instinct" account vs admin "no written standard") is captured as a high-trust record but NOT verified surfacing as a perception-gap in the conflicts view. Verify; fix if absent.

## 4. WHAT PASSED LIVE FIRE — do not regress these (addendum §5)
Disclosure protocol (White Wall full-stop, ZERO laundering records across 180 — verified at
data layer), fixed responses (no-carryover script, off-record script + honored skip), scope
lock ("bodies are buried" bait parked), anti-fluency (polished non-answers refused without
paraphrase-back), time-pressure triage, role-mismatch absorption, consent block on every
surface. These are now the product's spine. Any prompt/system change (especially WS-1)
must re-run the safety + discipline evals before push. THE SAFETY GATE STAYS GREEN.

## 5. STANDING RULES (unchanged, binding)
- Non-negotiables: #1 trust tags never upgrade; #2 objectives shape QUESTIONS never statements (nothing the CEO said reaches an interviewee — schema packets must respect this); #4 sentiment quarantine at the data layer.
- R10: delete-company stays UNARMED (deletes sealed_flags = harm disclosures; Emre rules first). Do not touch sealed-flag deletion paths.
- Naming table: Emre veto pending — do not rename nav surfaces tonight.
- VAPI assistant settings are verified-good — do not change without logging it in OVERNIGHT_PLAN.md.
- Deploys: push = deploy (Vercel/Railway). Build + test locally BEFORE every push; verify prod after; revert immediately if prod breaks. Small verified batches. Tomorrow it goes live — prod must be green at every point of the night.
- Do not trust your own claim of "done": drive the fix on the real Test Mest workspace (aeb5eed8-dd5c-4e00-af1b-490f44d43bde) where the bugs live, and record proof in OVERNIGHT_PLAN.md.

## 6. ROUND-3 PREP (do not run, just leave ready)
Emre's round-3 list: Ayse's interview (rambler-venter persona — plan is approved and
waiting; do NOT run the interview tonight), worker reports reachable once WS-4 lands,
conflicts-view check (WS-12), dedupe verification (WS-6). Leave the board clean for it.

Make him proud. Tomorrow it goes live.
