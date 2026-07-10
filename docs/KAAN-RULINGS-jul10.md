# KAAN RULINGS — July 10 (answers the pilot's open questions; overrides where they conflict)

The session's docs/DAY-ORDERS-jul10.md is the plan. THIS file carries Kaan's live decisions
on the pilot's open questions — the session cannot derive these; they win on conflict.
Mode: "full attack" but "make sure fixes happen CAREFULLY; ship what didn't ship last night."

## R1 — Live-capture display (pilot §4 conflict): AUDIENCE SPLIT
Kaan: the live-capture panel is GOOD — the value is "seeing what's happening, is the agent
functioning." Emre: respondent must not see the CONTENT (they perform for the record).
RESOLUTION (build this):
- ADMIN / observer side (workspace nav present — Kaan's reference screenshot): KEEP the rich
  Captured-live panel WITH content (Teams / Systems / Workflow / Decision rule / Goal, with
  Just-added / Saved states). This is where Kaan wants to see the agent working.
- RESPONDENT-facing room (/i/token AND the founder self-serve context call): show ONLY the
  agent-state rail (Listening / Thinking / Saving insight / Speaking / Reconnecting /
  Reconnected) + a bare capture COUNT ("21 items captured", live waveform). NO item content,
  NO item list on the respondent side. Proves the agent is alive without making the
  respondent perform. This satisfies both Kaan and Emre.

## R2 — Section 7 reviewer notification (pilot §? / S7 7.7): EMAIL to Kaan + Emre
The notify-the-reviewer step = an email to Kaan and Emre with {category, tier, timestamp,
session_ref} — NO verbatim content. In-app incident queue is a later nice-to-have.

## R3 — Emre's failure-bait transcript = PERMANENT eval source. YES.
Mine pilot Appendix A/B for founder-flatter (F6), no-rating (F5), humor-on-person (F4),
sequence (F3), automation-context (F2), identity-claim (F10). Anti-theater discipline holds.

## R4 — Positioning split (pilot §7): WORKING ASSUMPTION = operator work stays Nexus-side
Interview-ops (plan review, never-lists, handling notes, approval, refinement) stay
Nexus-side. Do NOT over-expose plan-editing to a CEO seat (a CEO would ask the interviewer
to hunt opinions about people — Test Mest's first refine would have been "who's coasting").
No build decision this week; just do not contradict this. Formal split lands with
client-seats (dormant). The current intake/plan-chat are ADMIN-operator surfaces = fine.

## R5 — "Full attack, ship what didn't ship last night"
Fold in the SIMPLIFY-PARK residuals + un-driven surfaces + design polish + the automation-
opportunities-orphan check + Marmara thin-compile check, as lanes free up. Careful over fast.

## Still human-gated (unchanged, do NOT build without the nod)
delete-company arming (§6-1 + Emre sealed-flag ruling) · naming table (Emre veto) ·
CEO-consent final wording (Kaan+Emre) · retention-limit exact value + counsel duty rows
(Section 7 Appendix A "Pending", reviewer-maintained).

## Watchtower note to the session
Kaan's product API credits were topped up ($30) — the test-mest recovery already ran (13
jobs). The test-mest workspace (aeb5eed8-dd5c-4e00-af1b-490f44d43bde) is the live repro for
the §2 three-costume bug; verify the fix DRIVEN there. Watchtower runs a deduped commit +
failed-job monitor and clears orphaned post-teardown jobs — do not chase those.

## RULINGS ROUND 2 (Kaan, ~08:30 — "rest all build, knock em out")
- **R6 — NO SendGrid. Safety notify = IN-APP admin incident inbox, not email.** Kaan has no
  SendGrid/incident-email. So harm incidents surface in an ADMIN incident queue inside the app
  (Emre + Kaan see them on open) — no external dependency. Email stays optional (fires only if
  a key ever exists). Incidents are already recorded + logged; this adds the human-visible
  surface. Build the inbox; drop the email hard-dependency from the "done" bar.
- **R7 — Consent line: SHIP.** Re-land the Section 7 §7.8 line (revert the revert 8a03c9e).
  Kaan approves the wording; Emre can refine later, it ships now.
- **R8 — Report footer wording: SHIP as-is** (honest correction, Kaan trusts the call).
- **R9 — Naming table + Emre round-2 note: watchtower drafts as Gmail drafts for Kaan to send.**
- **R10 — DELETE-COMPANY: STILL HOLD (do NOT arm).** It now intersects the safety system we
  built today: deleting a company deletes its sealed_flags = harm disclosures. Arming it
  without Emre's explicit sealed-flag ruling would let a company-delete WIPE a Tier-2 harm
  record. This is exactly the confirm-before-destructive case. Keep gated; Emre rules first.
