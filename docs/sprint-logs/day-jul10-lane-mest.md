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

## Audit verdicts
- Commit A (voice.py guaranteed idempotent compile): BUILD ok, tests green, no double-compile
  by construction (single-row CAS). Verdict: SOLID pending seam-A driven-verify.
- Commit B (plan precheck): BUILD ok, tests green, no behavior change when records exist.
  Verdict: SOLID.
- Commit C (reconcile backstop): BUILD ok, tests green, prod-preview well-scoped (1 heal).
  Verdict: SOLID pending seam-A driven-verify.
- Driven verify on test-mest (VAPI call → compile → snapshot → plan → paste): PENDING seam A
  (team-lead deploys; I do not). Script above.
