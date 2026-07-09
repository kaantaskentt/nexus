# Night marathon orders — July 8/9 (Kaan-approved, watchtower-relayed)

Read first: CLAUDE.md, docs/SPRINT-STATE.md. Standing law binds: BUILD→AUDIT→NEXT, stress-test everything, break nothing that works, no em-dashes client-facing, verify on prod.

## Limit protocol (Kaan's explicit rule)
Watch your usage. At 95% of the session limit: STOP mid-nothing — commit+push, write the live todo into SPRINT-STATE (done/in-flight/next), park, and note the reset time. Resume when the limit resets. The watchtower checks every 30 min and will kick resumes.

## Features (all flexible/modular by design — they may be reshaped later)

**F2 — Monday Morning Report (build now).** One button: "Export the Company Report." Print-ready branded page + shareable link: snapshot, workflows, gaps, opportunities with honest ROI, next steps. Branding decision (watchtower, per Kaan delegation): CLIENT-branded header (their company feels ownership when forwarded) + quiet "Powered by Nexus" footer. Export logic modular — a future Skills execution may reshape it.

**F3 — Weekly Pulse (build now, OFF by default).** Per-workspace admin toggle. Monday digest generated from the week's records delta: what Nexus learned, new conflicts, promises kept/pending, one suggested next step. In-app card + copyable WhatsApp-ready text. No auto-sending.

**F5 — Trust Center (build now).** One page assembling the existing truth: quarantine, sealed flags, consent promise, Simulations proving record, data boundaries. Placement per Kaan: linked from the footer as privacy/policy territory. Content-only, zero coupling to system logic.

**F6 — Client seats (build now, DORMANT).** Client role scoped to own workspace, hiding internal machinery. Behind a flag with ZERO behavior change for current admins. Auth must not break — we are the only users right now.

**F7 — NEW: "Beta: Conduct Context Call with CEO" (parallel lane, big).** A beta toggle at company creation (and an entry in Simulations) that lets the founder/admin do the Stage-3 context call WITH Nexus directly (voice/text) instead of uploading a transcript. This needs a NEW persona: the context-collector — different objective from the employee interviewer (it fills the Stage-3 exit-condition table: pain symptoms, AI history, names+reads, belief walkthrough, boundaries, sign-off criteria, shadow tools, vocabulary, NEVER list, success sentence, artifact ask). Source docs: docs/emre-inbox/stage-3-ceo-call-v04.md (the exit conditions ARE the objectives) + the existing interviewer persona as the base voice. Full new rules + eval suite (calibrate against the stage-3 example dialogues; adversarial cases: rambler CEO, seller CEO who wants to pitch, CEO who asks what Nexus is). Compile output feeds the same pipeline. Label BETA everywhere. Kaan+Emre are the test users.

**F8 — NEW: Admin role-play simulations.** Admin-only section (Simulations page): "Jump in as the employee" — the admin picks a persona (the five cast members, or company-context-relevant ones) and takes a live interview AS that character, testing the interviewer. After the call: an observation debrief (what the interviewer did well, what it missed, per-objective) — the strong feedback loop. Google Drive export of the debrief: log as flexible/nice-to-have, do not build tonight unless trivial. Keep fully firewalled from real records (voice_test-class).

## UI debate chamber
Spawn TWO UI-specialist teammates. They walk EVERY page on prod, debate alternatives out loud (their argument transcript saved to docs/UI-DEBATE.md), and deliver 3-4 major change proposals with visual concepts. Implement only clearly-safe wins; bold changes stay proposals for Kaan.

**Special focus (Kaan's direct feedback): the voice interview room.**
1. The transcript is stuck in a small box — expand it, let the conversation breathe.
2. Sentence fragmentation: a 1-second pause creates a new sentence/bubble — group utterances smarter (pause-tolerant sentence assembly at the display layer; verbatim storage untouched).
3. Add motion/physics to the transcript flow (entries settle in, smooth scroll).
4. INTERRUPTION SENSITIVITY: the model is hard to interrupt, yet sometimes cuts the speaker off. Research VAPI stopSpeakingPlan/startSpeakingPlan properly (numWords, voiceSeconds, backoffSeconds, smart endpointing interplay) and tune to: a cough or "hmm" does NOT stop the agent; a real sentence-start DOES. Smallest safe change — do not destabilize the working voice system. Test with a real API exchange after.

## Order of attack
F2 → F3 → F5 → F6 (flagged) → UI debate (parallel lane from the start) → F7 persona+evals (parallel lane) → F8. Park protocol at limits per above.
