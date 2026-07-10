# LANE-EXPORT — day-jul10 (shareable Company Report leaks)

Surfaces owned: `backend/app/routers/company_report.py`, `frontend/src/app/r/**`,
`evals/adjudication/**`. Cross-lane touches announced to team-lead:
`backend/app/pipeline/conflicts.py` + `prompts/agents/perception-gap.md` (staged patch #29,
directed by team-lead — no other lane owns these), and
`frontend/src/components/snapshot/ExportReportButton.tsx` (order item 5, unowned file).

Mission: the r/ report is a FORWARDABLE document read by people who never saw our consent
promises. Every fix is consent-promise enforcement at the compose/data layer, not React.

Base HEAD at start: e53b7e4. Working tree carries lane-sec's interview.py/test_interview.py
— every commit here is scoped `git commit -- <paths>` so those never leak in.

---

## A28 pre-reviews (two lines each: today → after; simpler or more complex for the user?)

### C1 — Re-identification pass (leak 1)
Today: findings are role-only, but free text (finding bodies, next steps "owner: Burak",
workflow step "route returns questions to Selin", snapshot bodies) still carries personal
names → the role mask is transparent in a ten-person company.
After: one compose-time de-identification pass redacts every known person-entity name from
the content sections, replacing with the person's role ("the operations lead") or a neutral
"a colleague"; the interview next-step is rebuilt from roles/count, never names.
Simpler for the reader: SIMPLER — the document is now consistently role-only; no reader can
cross a named next-step against a role-masked pain. Data-layer, not CSS.

### C2 — Trust-tag laundering (leak 2)
Today: a hand-added CLAIMED record renders as an unlabeled finding, and a workflow spawned
from a single CLAIMED record renders with no qualifier — footer promises confidence levels
that aren't shown.
After: findings below CONFIRMED and workflows resting only on sub-CONFIRMED records carry an
honest visible qualifier ("Claimed — not yet verified" / "Provisional — built from
unverified records"). Tags never upgrade (non-negotiable #1); this is honest display only.
Simpler for the reader: SIMPLER (more honest) — the footer promise becomes literally true;
no new interaction, just an accurate label where one was missing.

### C3 — Test artifacts + numbering (leak 3)
Today: empty "New manual step (still to confirm)" placeholder cards export as real steps and
step numbering jumps (9 → 12 → 13) because hidden/dropped steps leave gaps in the index.
After: compose drops empty manual placeholders and re-numbers surviving steps contiguously.
Simpler for the reader: SIMPLER — no phantom steps, numbering reads 1..n. Test-pinned.

### C4 — Self-correction shown as conflict (leak 4) — staged patch #29
Today: the founder's twelve-to-ten self-correction renders as CONFLICTING ACCOUNTS
founder-vs-founder (the retracted "12" seeds a perception gap against the current "10").
After: apply staged patch #29 — the comparator excludes a claim whose superseder shares the
SAME speaker (authorial self-correction), keeps CROSS-speaker supersedes (that divergence IS
the gap). Lands with its deterministic eval cases (backend test + perception-gap.md rule 7).
Simpler for the reader: SIMPLER — a founder correcting his own number is no longer shown to
the client as two founders disagreeing.

### C5 — Export modal backdrop transparency bug (small)
Today: `ExportReportButton` dialog backdrop uses `bg-ink/25`; background text bleeds through
(same class as the pre-July-8 add-company bug Emre already had fixed to a solid scrim).
After: use the canonical `bg-scrim` token (rgb 31 26 19 / 0.32, "drawer/modal backdrop"),
matching the ratified July-8 add-company fix.
Simpler for the reader: SIMPLER — the dialog reads as a dialog; nothing bleeds through.

---

## A24 classification — staged patch #29 (Emre pilot §3 "promote it")

**ADOPT.** Emre's pilot §3 ("The staged same-speaker-retraction patch addresses exactly
this; promote it") is a fresh ratification that RELEASES the SIMPLIFY-PARK F21 hold on an
already-built, already-verified fix. New + compatible + clearly improves: it removes a
confident-fiction failure (a self-correction miscast as founder-vs-founder conflict) without
touching the provisional F21 precedence policy (still isolated in `precedence_lean`, still
labelled provisional). Speaker-aware by design — it keeps cross-speaker supersedes comparable
so the real perception gap (the yıldırım case) survives. Not CONVERGENT (this is net-new
behavior, not our existing build re-derived) and not CONFLICT (nothing tested regresses).

---

## Build log (verdicts appended as each commit lands)
- **C1 re-identification pass** — company_report.py compose now redacts every person-entity
  name (full + first/last tokens) to their role or "a colleague"; interview next-step rebuilt
  from roles/count. New DB-less test test_report_deidentify.py 4/4 green: the co-occurrence
  guard bites on the raw payload (role-attributed pain + names) and is clean after the pass.
  AUDIT: SIMPLER for the reader — document is now consistently role-only. Data-layer, not CSS.
- **C2 trust-tag honesty** — findings below CONFIRMED (CLAIMED/GUESS/SCRAPED/untagged) now
  carry `unverified` + a dashed qualifier chip ("Claimed — not yet verified" etc.); workflows
  whose backing claims never reach CONFIRMED carry `unverified` + a "Provisional — built from
  unverified records" caption. Footer reworded to drop the false "nothing here is edited by
  hand" (hand-added CLAIMED records exist) and to state the confidence promise truthfully.
  Tests test_report_trust.py 4/4 green; tsc clean. FLAG to Kaan (via team-lead): footer copy
  is client-facing — I made the minimal honest correction the mandate requires; taste nod.
  AUDIT: SIMPLER (more honest) — the footer promise is now literally true.

---

## Seam-B driven-verify script (team-lead runs post-deploy; lane prepares)
Prereq: seam-B deploy live (migrations first), test-mest workspace compiled.
1. Mint the test-mest report: admin → workspace → "Export the Company Report" → copy /r link
   (or POST /api/company-report/{ws}/share). Open on prod.
2. **Leak 1 (re-identification):** Ctrl-F the rendered page for every known person name
   (Burak, Selin, Ayşe, Berk, Ahmet, Rifat, Ahmet Yayci, Rifat Boyaci). Expect ZERO hits.
   Every attribution reads by role. Screenshot the "Next steps" + "How work flows today"
   sections.
3. **Leak 2 (trust-tag):** confirm the hand-added CLAIMED pain renders with an "unverified"
   qualifier and any workflow spawned from it shows "Provisional — built from unverified
   records". Screenshot the key-findings + workflow sections.
4. **Leak 3 (test artifacts):** confirm no "New manual step (still to confirm)" placeholder
   appears and step numbers run contiguously (no 9→12 jump). Screenshot the workflow steps.
5. **Leak 4 (self-correction):** confirm the twelve-to-ten founder correction does NOT appear
   under "What does not line up" as founder-vs-founder. (For an already-compiled conflict row,
   note it in the log; the structural fix prevents recurrence on the next compile.)
6. **Modal bug:** open the Export dialog on an admin snapshot; backdrop is solidly dimmed,
   no background bleed. Screenshot.
7. Record all screenshots + a one-line PASS/FAIL per leak class in the Build log above.
