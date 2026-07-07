# Emre merge packet — July 7 2026 (A24 classification, every delta)

Stance: A24 — Emre's docs enrich, never replace; the tested build holds presumption of
correctness. Every delta below is classified ADOPT / CONVERGENT / CONFLICT / OPEN with
reasoning. Contested calls needing Kaan+Emre are marked ⚑. Commits: e4b71ad (fixed
responses) · two-strike/scope-lock · sealed flags · playbook/yield · stage-3 hooks.

## Stage-7 draft (stage-7-interview-agent-draft1.md)

### §2 Two layers (conversation / navigation, "navigator never leaks")
**CONVERGENT.** Our build already separates persona (stage7-interviewer.md) from engine
(interview.py + computed coverage), and the persona already bans checklist energy. Emre's
"the navigator never leaks into the voice" is the same rule our coverage block phrases as
routing guidance the persona renders naturally. No change; design validation.

### §2 Knowledge isolation ("what it does not have, it cannot leak")
**CONVERGENT — architecture identical.** Handoff package is the agent's whole world
(handoff.py strips attribution, drops known_context; quarantined rows never leak). Emre
independently specified what QA F1 already enforces. Validation, no change.

### §3 The arc (opening restates promises; close never sacrificed)
**CONVERGENT with one enrich.** Opening arc = A20 opener restoration (already EMRE-SEAM
for wording). Close = our three-beat Closing moves; Emre's "what should I have asked" is
already beat 2. His "close is never sacrificed to coverage" matches close-on-clock
behavior. The exact opener wording remains Emre's seam (unchanged).

### §4 Navigator statuses (untouched/opened/partial/met/blocked/deferred)
**CONFLICT → tested build wins.** Our computed coverage uses satisfied/partial/untouched,
A/B-tested (proof-matrix round 1-2; round 3 in flight). Emre's richer 6-status model adds
opened/blocked/deferred. Renaming or extending mid-A/B would contaminate round 3 and
regress a tested seat for vocabulary alone. Kept ours; blocked-by-subject exists at the
prompt layer (two-strike + NEVER handling) and in yield_stats.coverage as the audit's
3-state map. Revisit only if a real routing need for the extra states appears.

### §4 Two-strike rule
**ADOPT** (prompt section + navigator eval suite + coverage-directive escape clause).
Guard added so it can never soften anti-under-probing: deflection = real dodge; thinness
still gets probed (eval nav-two-strike-not-thinness pins this).

### §4 Scope lock
**ADOPT** (prompt section + evals). Extends derail-1c (noise tangents) to gold tangents.
One-clarifier allowance added so parking is informed — judged compatible with Emre's
intent ("acknowledges warmly, parks it").

### §4 Time & burden / tea-break, attention checks
**OPEN as marked.** Tea-break self-pausing concept is Kaan-gated (Emre's own flag). Our
existing 20-min pause offer + time-pressure handling stays (tested, A5). v1 attention-
check signal set NOT built — needs the tea-break decision first. Phase-two burden
detection also OPEN.

### §5 Core moves
**CONVERGENT (episode, de-anchor, silence, one-question) + ADOPT three enrichments:**
contrast/near-miss move, checkpoint-before-topic-switch, artifact chase (ask at the
moment of mention). Artifact chase conditioned on package.artifact_sharing_authorized —
the agent never asserts a blessing nobody captured (see stage-3 hooks below).

### §6 Fixed responses
**ADOPT — the flagship delta.** Nine canonical scripts as an invariant layer + hard rule
14 + fixed-responses eval suite (9/9). Two wording adaptations, logged:
- ⚑ *"Is this anonymous?"*: Emre's flat "nothing gets quoted back with your name on it"
  conflicted with tested EK 3.2 (named quotes CAN go out after preview + explicit
  release). Merged to "nothing goes out with your name on it unless you've seen it first
  and said yes" — keeps his never-promise-more-than-the-math constraint, keeps our
  preview/release mechanism. Flag for Emre's blessing on the wording.
- Sponsor name domain-neutralized ([the sponsor] ← "Ece"), per A14.
- "One gentle automated resume reminder" (his §6 stop script post-action): NOT built —
  A22 cut the reminder scheduler (no writer). Pause/resume works; reminder returns only
  if real usage demands it. The script's respondent-facing text promises nothing about
  reminders, so no honesty gap.

### §7 Disclosure protocol
**Tier 1 CONVERGENT** (venter handling, pain data, no escalation — already our
anti-sycophancy vent line). **Tier 2 ADOPT at the data layer**: sealed_flags table
(0011) outside the record store, no client route, disclosure_screen job beside compile
at both completion sites, compiler disclosure boundary (allegations never become
records), interviewer never-probe handling. **Tier 3 OPEN — stub only, exactly as Emre
marked**: stop-care-route paragraph; stop script + routing contacts are Emre's to author
personally, Kaan to confirm, before any live interview. Abandonment: partial-compile
already true; abrupt-quit-after-sensitive flag category exists in the screen; the
consent-line copy ("if you stop partway...") is a ⚑ small copy addition for Kaan's
taste pass — not shipped unilaterally since consent copy is client-facing.

### §8 Person-handling playbook
**CONVERGENT + ADOPT, folded into ONE taxonomy** (two competing typologies in one prompt
would fight): rambler/venter/pleaser added as new reads; monosyllabic enriched our terse
read (concrete objects, artifact-first); performer ≈ our PR/proud-maker reads (artifact
detail adopted); suspicious folded into the doubt line (smaller asks, partial-is-a-win).

### §9 Baseline voice
**CONVERGENT.** Warm/plain/curious, one question, silence-tolerant, validates effort
never opinions, never performs enthusiasm — matches our persona + anti-sycophancy nearly
clause for clause. Strong design validation of both documents. Persona FAMILY = OPEN
(Emre+Kaan session, as marked).

### §10 Outputs
**ADOPT yield stats** (compute_yield job + yield_stats jsonb, 0012): deterministic
Question Yield Score from verbatim evidence quotes + fail-open final coverage audit
(objective statuses back to the plan). **CONVERGENT the rest**: transcript→compiler,
DISPUTED pairs, artifact example bank, vocabulary append (topic=vocabulary records feed
handoff), discovery buffer (compiler NEW-PERSON / INTERVIEW-OBJECTIVE / SEQUENCING
triggers ARE it). Approach-notes observed-vs-exec-read source marking: small follow-up,
not built (handoff merges both today; needs a provenance label, low stakes, queued).

## Stage-3 v04 (stage-3-ceo-call-v04.md) — human-led; build hooks only

- **People-map branch → ADOPT session_kind='people_map'** (0013): discovery-upload route
  accepts the kind, requires a named subject, never relabels founder/snapshot source.
  Compile path standard; reads quarantine as always. Agent-led people-map = later, behind
  the Stage-6 gate like any interview.
- **Artifact ask authorization → ADOPT**: mission.artifact_sharing_authorized →
  handoff package bool → interviewer only invokes the sponsor when True.
- **Sign-off criteria + boundaries → VERIFIED, compiler already supports**:
  success-criteria topic captured verbatim (enum + prompt), boundaries land as
  process-step/company-fact records; spine_slots column preserved per A10. No change.
- Checkpoints/phases/example dialogues/heuristic scoring → human-led process content, no
  build surface. The v04 doc supersedes v03 in reference reading order (its own header
  says so).

## Pre-existing issues surfaced by this merge (not regressions)
- **flatter-2d eval is flaky** (fails ~2/3 on pre- AND post-merge prompts): the judge
  sometimes fails the venter-bridge move ("when did that last slow things down?") that
  BOTH Emre §8 and our own prompt sanction as capture. ⚑ Emre should rule: either the
  bridge-through-the-complaint move is capture (loosen the case's fail_if) or the move
  itself needs reshaping. We did not touch the eval — relaxing an anti-sycophancy case
  to pass our own build would be grading our own homework.

## ⚑ Surfaced to Kaan+Emre (everything else was judged on merits and logged above)
1. Anonymity script wording (mechanism promise vs preview/release — merged text needs
   Emre's nod).
2. flatter-2d judge-vs-move ruling.
3. Consent-line partial-compile copy addition (client-facing, Kaan taste).
4. Tier-3: Emre's dedicated pass + Kaan confirmation (OPEN, stub live).
5. Tea-break self-pausing (OPEN, Kaan).
