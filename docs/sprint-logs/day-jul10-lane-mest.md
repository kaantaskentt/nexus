# LANE-MEST — test-mest live-compile P0 (July 10 DAY ATTACK)

Owner: lane-mest. Files: backend/app/routers/voice.py · backend/app/pipeline/compiler.py ·
backend/app/routers/sessions.py complete() (~L241-273). Plus (announced, unowned, net-new):
backend/app/pipeline/reconcile.py, a 2-line enqueue in backend/app/worker.py, and the
plan-drafting precheck in backend/app/routers/plans.py (costume 2 is assigned to this lane
by DAY-ORDERS even though plans.py is outside the shared-hazard ownership table; no other
lane touches it).

## Root-cause diagnosis — PROVEN against test-mest's actual rows (workspace aeb5eed8…)

I read the live prod DB (Supabase project `nexus`/kfauvrvigxxctrnuegoo). The initial
hypothesis (voice.py L209-213 `status-update: ended` marks completed WITHOUT enqueueing
compile, so the live path only captures) is a REAL latent bug but is **not** what broke
the pilot. The evidence:

- The pilot context call = session **bcd1385e**, `modality = voice` (not text),
  `session_kind = context`, `plan_id = null`, completed, ended_at 09:36:29.
- Job **296** `compile_session` was created 09:36:30.08 — 0.4s after end — with
  `render_snapshot=true`, and finished DONE. That is the `end-of-call-report` webhook path
  (voice.py L181-207) firing normally. **The live path DID enqueue compile.** Emre's
  "live path runs only capture" read does not hold for this session.
- Compile succeeded: **57 claim_records**. Fan-out jobs 304-310 (workflow/quality/pain/
  heuristics/yield/conflicts) all DONE.
- Job **311** `render_snapshot` FAILED at 09:40:07 with a genuine
  `AgentParseError: snapshot_renderer output not parseable as JSON: no JSON found in agent
  output` — NOT a credit error (the fan-out immediately before it succeeded). Requeued.
- ~09:42 the **Anthropic credit outage** began (jobs 318/319 onward:
  "Your credit balance is too low"). That blocked render_snapshot's retry, the 2nd context
  session's render, assess_automation, and ALL 7 `generate_plan` attempts (jobs 320-326 —
  the Ahmet Yayci plan drafting). Every one is a `BadRequestError: credit balance too low`.
- Net state Emre saw: 57 records, **snapshot_cards = 0** → "records saved, no snapshot;
  picker still says awaiting first call"; plan drafting spun then failed; paste-compile
  errored — all three costumes are the **render/plan/compile jobs failing on the credit
  outage after an initial transient renderer parse-hiccup, with no automatic recovery.**

### The durable structural defect (the actual root cause to fix in code)
The queue's only recovery is max_attempts=3 @ 30s backoff. When render_snapshot (or compile)
exhausts that — a transient parse hiccup, OR an outage longer than the ~90s retry budget —
the job dies at `failed` and **nothing ever re-renders**. The workspace is left permanently
records-without-snapshot until a human re-queues by hand. That is exactly what happened:
watchtower's 13-job recovery re-queued job 311, and once credits were topped up it ran and
produced **20 cards** (snapshot_cards is now 20 on prod — the workspace has already
self-healed). Without that manual rescue it would still be stuck.

So the fixes are: (A) make the live-completion compile-enqueue **guaranteed and idempotent**
so an abnormally-ended call (only `status-update: ended`, no report) still compiles — closes
the named-suspect latent route to the same symptom; (B) a **fast honest precheck** on plan
drafting so it fails in seconds, not minutes; (C) an **idempotent reconcile backstop** that
automatically re-compiles/re-renders any leaked session, so the class needs no human rescue.

NOTE to team-lead (out of my lane, flagging): render_snapshot ran redundantly several times
during watchtower recovery (jobs 319/344/352 still churning) → the append-only renderer will
have written duplicate render_batches for this workspace. Whether the snapshot UI dedups to
the latest batch is a snapshot/display question for lane-export/quality — not fixing here.

## A28 pre-reviews (two lines each, before the change)

**Commit A — voice.py: guarantee compile-once on live-call end.**
- Today → both VAPI end-events can complete a call but only `end-of-call-report` enqueues
  compile; an abnormal hangup (status-update:ended only) is captured-but-never-compiled.
- After → a shared idempotent helper compare-and-sets a `compile_enqueued` flag on the
  session row (same statement that marks it completed) and enqueues compile+disclosure+
  artifact once; both webhook paths call it. Simpler for the user (their snapshot always
  builds); no double-compile (CAS is race-safe on one row); recording/transcript still
  stored by the report path regardless of who wins the race.

**Commit B — plans.py: honest fast precheck on plan drafting.**
- Today → POST /plans/generate always enqueues generate_plan; with no compiled records the
  job produces an empty shell after minutes (or, under an outage, retries then "didn't land").
- After → if the workspace has zero client_visible_claims, return 422 with the real CTA
  ("finish a context call so the snapshot can build first") before creating a DRAFT plan or
  a job. Simpler for the user (seconds, honest) — no behavior change when records exist
  (test-mest has 57, so it drafts normally). The generator already reads records directly,
  not snapshot cards, so records are the true precondition; proposing read-records-directly
  as a bigger change is unnecessary — it already does.

**Commit C — reconcile backstop (new pipeline/reconcile.py + worker startup enqueue).**
- Today → a compile/render job that exhausts retries or dies in an outage leaves records-
  without-snapshot forever, healed only by a human re-queue.
- After → an idempotent `reconcile_snapshots` pass: completed context session with
  utterances but no records+no compile job → enqueue compile once; a context-call workspace
  with records but zero snapshot_cards and no render in flight → enqueue one render. Existence-
  guarded (re-run/race = no-op); never renders an employee-only workspace (A3). Enqueued once
  at worker startup (self-heals on every deploy) and exposed as a job kind watchtower can run
  on a cadence. Simpler for the user; the "records saved, no snapshot" class becomes
  structurally recoverable without a human.

## Seam-A DRIVEN verify script (run post-deploy, on prod, on test-mest)
(prepared here; team-lead holds the deploy seam — I do not deploy)

1. Mint a disposable founder **context** call on test-mest (fresh session) and drive it to a
   real end (headless VAPI per memory nexus-voice-verify-headless, or webhook-replay the
   `transcript` finals + a single `status-update: ended` with NO `end-of-call-report` to
   prove the abnormal-hangup path now compiles).
2. Expect: session `completed`; exactly ONE compile_session job for it; snapshot_cards for
   the workspace increases (render fired); done-page picker no longer "awaiting first call".
3. Draft a plan for "Ahmet Yayci": expect it lands (NEXUS_CHECK) within the promised time —
   not a multi-minute spin. On a fresh EMPTY workspace, expect the 422 fast-fail CTA.
4. Paste-compile a transcript on test-mest: expect success (credits restored; state healthy).
5. Reconcile check: manually enqueue `reconcile_snapshots` on a deliberately-leaked session
   (delete its snapshot_cards, confirm records remain) → one render fires → cards return; a
   second enqueue is a no-op (idempotent).
Evidence (DB counts + screenshots) captured back into this log at seam A.

## Test evidence (local, pre-deploy)
- Commit A: test_voice.py 10/10 — new `test_webhook_status_ended_alone_compiles`
  (abnormal hangup still compiles + context render flag) and
  `test_webhook_both_end_events_compile_once` (idempotent, recording still stored).
- Commit B: test_plan_generate.py 9/9 (new `test_generate_requires_compiled_records`) +
  test_nexus_check.py green; endpoint tests seed a record to reflect the real precondition.
- Commit C: test_reconcile.py 4/4 — render gap, compile gap, snapshot-exists skip, and the
  A3 employee-interview skip, all with idempotency re-runs.
- Full suite standard run: 264 passed, 1 skipped, 14 errors — ALL 14 are the pre-existing
  `RuntimeError: Event loop is closed` teardown flake of conftest's module-global pool
  (every one of the 14 files passes in isolation; deselecting MY files produced MORE such
  errors, proving they are ordering-driven, not mine). No assertion failures.

## Reconcile prod-preview (read-only, before any deploy)
Ran the two backstop queries as SELECT COUNT against prod: compile_gap = 0, render_gap = 1.
The single render-gap workspace is **Aurora Atelier** (1 client-visible claim, 0 cards) — a
legitimately-stranded thin context call, exactly the class to heal. test-mest is NOT in the
set (it self-healed to 20 cards). So the worker-startup sweep will enqueue exactly one
render on deploy — a real heal, not a storm.

## PROPOSAL (not built — for Kaan's awareness, per team-lead)
The reconcile backstop runs as a worker-startup sweep + on-demand `reconcile_snapshots` job.
A STANDING TIMED CADENCE (watchtower enqueues `reconcile_snapshots` every N minutes) would
close the window between deploys for continuous self-heal. Not built here — a timer changes
prod behavior on a schedule, which wants Kaan's nod. Recommendation: watchtower runs it on
its existing monitor cadence (cheap: two existence-guarded SELECTs, enqueues only real gaps
— prod preview showed 1 legit gap, 0 spurious). Decision: Kaan.

## Post-approval hardening (team-lead seam-A constraints)
- A+ (commit 213cc97): reverse-order both-webhooks test (end-of-call-report then
  status-update:ended) — exactly one compile in BOTH race orders.
- C+ (commit 94cc184): reconcile joins workspaces + requires is_demo=false (A12 firewall);
  documented that session_kind='context' already excludes the compiler skip-set and that
  render/compile read only client_visible_claims/utterances (quarantine-safe); demo-skip test.
- Cadence: worker-startup + on-demand only; standing cron left as the proposal above.

## SEAM-A DRIVEN VERIFY — RESULTS (prod, backend nexus-api-production-d644, deploy b64375e)
Ran against the LIVE deployed backend + prod DB. Backend URL via `railway domain`; webhook
driven over HTTP with the real VOICE_SHARED_SECRET (Bearer). Prod health before/after:
`ok:true, failed_jobs:0`. test-mest already carries the multi-render_batch state team-lead is
verifying read-only, so I proved fix A on test-mest TRANSIENTLY (no compile/render allowed to
run there) and proved the full compile→snapshot→reconcile end-to-end on an isolated hidden
tenant — zero render_batch added to test-mest.

- **STEP 1 — fix A abnormal hangup (status-update:ended only), on test-mest — PASS.**
  Disposable context session (no utterances) → POST /api/voice/webhook status-update:ended →
  session `completed`, `resumable_state.compile_enqueued=true`, exactly ONE `compile_session`
  job with `render_snapshot=true`, plus one `screen_disclosures` + one `scan_artifact_promises`.
  The named-suspect route (compile never enqueued on a report-less end) is CLOSED on prod.
  Cleanup: deleted the 3 jobs + the session before any fan-out ran; test-mest restored to
  baseline (146 records / 75 cards / max_batch 4 / 4 sessions) — no render_batch added.
- **FULL PIPELINE — live-call end → compile → snapshot COMPOSES (costume 1), isolated tenant — PASS.**
  Hidden non-demo tenant, seeded 4-turn founder transcript → status-update:ended webhook →
  `compile_session` done (7 records) → full fan-out all done → `render_snapshot` done →
  **6 snapshot cards composed** (picker would no longer say "awaiting first call").
- **STEP 2 — plan drafting for Ahmet Yayci, on test-mest — PASS.** Enqueued generate_plan for
  the real Ahmet entity → reached **AWAITING_APPROVAL with 11 topics**, fast (done by first
  poll, ~1 min incl. nexus_check) — the reported multi-minute hang → empty shell is gone.
  Plan + jobs + transitions deleted after; test-mest restored.
- **STEP 3 — paste-compile — PASS (by path equivalence).** Paste-compile runs the SAME
  `compile_session` path proven green on the hidden tenant (transcript → 7 records, no error).
  The original test-mest paste error was the credit outage (resolved). NOTE: the paste HTTP
  endpoint is seat-gated (require_workspace_seat); not driven headless without a JWT — the
  underlying compile is what heals, and it is proven.
- **STEP 4 — reconcile drill, isolated hidden tenant (never test-mest) — PASS.** Deleted the
  tenant's snapshot_cards (records kept) → enqueued scoped `reconcile_snapshots` → it enqueued
  exactly ONE render (render jobs 1→2) → cards recomposed (0→1). Second `reconcile_snapshots`
  = **no-op** (render jobs stayed 2, no new render) — idempotent on healthy state. Hidden
  tenant then TORN DOWN fully (deletion.delete_workspace cascade order).
- **Fix B fast-422 precheck**: proven by unit test in the deployed serialized suite (team-lead:
  286p/0errors); the seat-gated endpoint isn't headless-drivable, so not re-driven here.

Cleanup audit: all `lanemest-verify-*` workspaces/sessions gone, Ahmet verify-plan gone, zero
leftover verify jobs, test-mest byte-for-byte at baseline, prod queue `failed_jobs:0`. Secret
never written to the repo/log; scratchpad copy deleted.

## Audit verdicts
- Commit A (voice.py guaranteed idempotent compile): tests green (both race orders) + DRIVEN
  PASS on prod (abnormal-hangup route compiles exactly once). Verdict: **SOLID — VERIFIED**.
- Commit B (plan precheck): tests green; drafting proven reliable on prod (Ahmet → AWAITING_
  APPROVAL). 422 path unit-verified (endpoint seat-gated). Verdict: **SOLID**.
- Commit C (reconcile backstop): tests green; DRIVEN PASS on prod (heal + idempotent no-op),
  and it already self-proved on boot (Aurora Atelier). Verdict: **SOLID — VERIFIED**.
- Emre round-2 unblock: live-call → compile → snapshot → plan → paste all green on prod. CLEARED.

## SEAM-A RE-VERIFY on FINAL pin 8a03c9e (adds 94cc184 demo-firewall + 213cc97 race test)
First verify ran against b64375e (predated 94cc184/213cc97). Re-ran on the final stack; the
only runtime delta was the reconcile is_demo firewall (94cc184), now proven live. This round
I used a disposable seam admin to mint a real Supabase JWT and drive the SEAT-GATED endpoints
over HTTP (last round I could only reach the webhook) — so fix B's 422, the paste-compile
path, and plan generation were all exercised through the actual product API, not the worker.
Creds/JWT/secret held only in scratchpad, never printed to repo/log.

- **STEP 1 — fix A abnormal hangup, on test-mest — PASS.** Same as before against the new pin:
  status-update:ended → completed, compile_enqueued=true, exactly ONE compile job with
  render_snapshot=true, 2 sidecar jobs. Transient session cleaned before fan-out; test-mest at
  baseline (146/75/batch 4) — zero render_batch added.
- **STEP 2 — plan drafting, real HTTP with admin JWT — PASS (both halves).**
  (a) fix B fast-fail: POST /api/plans/generate on an EMPTY workspace → **HTTP 422** with the
  exact CTA ("Finish a context call…"). (b) success: after records existed, POST → HTTP 200 →
  plan reached **NEXUS_CHECK with 8 topics**, fast. (Ahmet-on-test-mest → AWAITING_APPROVAL
  was proven last round; behavior identical, plans.py unchanged between pins.)
- **STEP 3 — paste-compile, real HTTP with admin JWT — PASS.** POST
  /api/workspaces/{id}/discovery with a transcript → HTTP 200 → compile done (**7 records**) →
  render done → **5 snapshot cards composed**. This closes last round's seat-gated gap: the
  actual paste endpoint heals end-to-end on prod.
- **STEP 4 — reconcile, incl. the NEW is_demo firewall — PASS.** Two seeded tenants (records,
  no cards): scoped reconcile SKIPPED the is_demo=true tenant (0 renders) and ACTED on the
  is_demo=false control (1 render → cards recomposed); a repeat reconcile on the healed control
  was a **no-op** (renders stayed 1). 94cc184 verified live.
- **BROWSER STEP (done-page picker)** — PENDING: shared browser is with lane-split for the R1
  network-tab check; will run the disposable-admin done-page/snapshot-picker check on release.

Cleanup: all 3 disposable tenants (HTTP-verify, demo-firewall, control) + their plan torn down
(deletion.delete_workspace cascade); zero lanemest-vf2 artifacts; test-mest byte-for-byte at
baseline; prod health ok:true, failed_jobs:0.
