# UI PARITY + ANYTIME-CONTEXT — Kaan orders (July 10, ~09:00). Background lanes.

Kaan reference mockups: docs/kaan-inbox/ (the 4 screenshots this order attaches — clean
context-call welcome 3-box + orb; polished live-room with Captured-live cards, agent-state
rail, reconnect pills, presence orb). Honest context: last night's E lane built the room
FUNCTIONALLY (voice+text, captured-live, states, reconnect) and verified it, but never got a
visual-parity pass to these mockups — design lane only did tokens + 2 small batches. This
closes that gap. Runs in BACKGROUND, parallel to the safety-gate work (do not disturb A.6).

## FIX-NAME: ROOM-PARITY (visual match, no behavior change — A28 display-only)
Make the live room (context call / employee interview / simulation — ONE component family)
visually match the mockups. Ignore mockup WORDING; match the DISPLAY:
1. **Interviewer presence orb** — the clean circular waveform orb (mockup 3/4), not the bare
   disc currently rendering. Same for the context-call welcome hero orb (mockup 2).
2. **Captured-live cards** — clean card per item (Teams / Systems / Workflow / Decision rule /
   Goal / Open question) with the icon tile, "Just added" (spinner) vs "Saved" (green check)
   states, and the live-capture waveform + count footer ("21 items captured · 82%"). ADMIN
   side keeps content (R1); RESPONDENT side stays counts-only — parity applies to BOTH shells.
3. **Agent-state rail** — the vertical Listening / Thinking / Saving insight / Speaking /
   Reconnecting / Reconnected timeline (mockup 4), clean dots + active highlight.
4. **Reconnect pills** — the "Reconnecting… / Reconnected" cards styled as mockup 4.
5. **Context-call WELCOME page** (mockup 2) — the 3 clean boxes (What Nexus will learn /
   After the call / Privacy) with check-row lists + the hero orb + Preview questions / Start
   context call buttons. Clean, calm, generous spacing.
6. Simulation room + real room + context call ALL use this one polished family (the sim room
   in mockup 1 is the BEFORE — bare; bring it to parity, keep the sim marker + counts-only).
Display-layer only: no pipeline/persona/capture logic changes. Verify at 1440 + 390.
Design refs allowed: Figma connector (Kaan's file) + Canva brand kit kAFmcOCu180 for assets;
adapt to the one Nexus system, never paste.

## FEATURE-NAME: ANYTIME-CONTEXT (the knowledge-engine loop — Kaan repeat ask)
Vision: the CEO can log in ANY TIME and talk to Nexus to add more context — Nexus is a
knowledge engine, not a one-shot intake. Build:
1. **"Add more context" button** on Home / Company Snapshot (near "Your next move" /
   Export). Primary-ish, clearly invites another conversation with Nexus.
2. Clicking it starts ANOTHER context call (voice or text) in the SAME polished room →
   session_kind 'context', additive to the existing snapshot (not a fresh workspace).
3. **Confirm-what-to-store mechanism**: as the CEO adds context, new facts are proposed and
   the CEO CONFIRMS what becomes company context vs discarded — reuse the intake-agent's
   context-storage decision (R? / ADD-4): "Saved to Company Context" vs "not stored", chips
   shown, attributed to the CEO as CLAIMED, quarantine holds on people-sentiment,
   non-negotiable #2 holds (nothing said reaches employees as a statement).
4. Additive compile: the new context call compiles into the SAME snapshot (supersede/append
   per ontology; corrections supersede, tags never upgrade). The snapshot grows.
5. A28: net-new surface + button on Home (existing) = pre-review the Home change; the room
   reuse is not a behavior change to the room.
Evals: additive context call attributes to CEO + confirm-gate honest (fact stored w/ chip,
opinion quarantined, vague input not stored) — mirror ADD-4 intake evals.

## Order
Both background, parallel to the safety gate. ROOM-PARITY first (Kaan's visible frustration),
ANYTIME-CONTEXT second (reuses the polished room). Seam-deploy + driven-verify at both widths.
