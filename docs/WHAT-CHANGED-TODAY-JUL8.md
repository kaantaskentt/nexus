# What changed today — July 8, Wednesday shift

One line of what, one line of why. Emre's per-item verdicts: docs/emre-inbox/CRASH-REPORT-VERDICTS-jul8.md.

- **Both of Emre's crashes fixed and proven on prod.** Ask-the-context white screen
  (the model's follow-up suggestions are objects; the UI rendered them raw) and the
  Observe crash on Ece (three of her compiled claims are untagged; the badge had no
  guard). Both reproduced first, fixed at the data boundary AND the render, re-verified
  live. Why: they killed the whole app for a client-facing question and a click.

- **A crash can no longer take down the app.** Error boundaries: inside a workspace the
  nav survives and says "this screen hit a snag"; on the respondent side the message is
  honest — nothing they said is lost (true: every turn is stored as it happens).
  Why: Emre called it the item that caps every future bug. He's right.

- **Every "Coming in this build" on the report is now a real button.** Generate SOP
  opens the workflow editor's working SOP drawer directly; View full transcript opens
  the interview view. Why: a stub next to a working copy of itself reads as broken.

- **Drawers close on Escape, stopped clipping mid-animation, and the step rails got
  real scroll arrows.** The editor's back link now says where you actually came from.
  Why: Emre's UX batch, all reproduced.

- **Navigation feels faster.** Every page was fetching the workspace list twice at
  ~700ms a call; now once. Warm page-to-page is ~1.5-2.5s (was 2-3s+). The remaining
  slowness is per-call backend latency — a real fix is scoped and logged, not rushed.

- **Voice settings: selection works (verified with a real browser click — the bug you
  saw was fixed by Monday night's deploy), and every voice has a preview again.**
  Deepgram voices play the provider's demo clip, labeled "Provider sample" so it never
  pretends to be our register; the moment ElevenLabs/Deepgram keys land, our own
  generated clips take over automatically. Why: your #27, with the ClearPath concern
  answered by honest labeling instead of silence.

- **Simulations page shows the real proving record.** The five characters we test the
  interviewer against, and the judged rounds — 14/16 hidden facts and zero baited cues
  in round one, the honest partial round three included — in client language. No Run
  button: launching simulations from the app stays proposed until you approve it.

- **Logo clicks home; breadcrumbs are links.** (#26 closed.)

- **Stranger walk found and fixed three real bugs in the plan journey:** returned
  drafts now show WHAT the check flagged (the reasons existed but were invisible);
  a refined draft can go back through the check without being thrown away ("Send back
  for check"); and the Send Interview dialog could render its Send button below the
  screen edge (same centering bug fixed elsewhere on July 7). The whole loop is proven
  live: generate → returned with flags → refine → re-check → pass → approve → send →
  respondent consent → interview running.

- **Your full new-client journey works end to end.** Fresh company → transcript →
  snapshot in ~5 minutes (sharp: it caught the shadow spreadsheet, the one-man schedule,
  the unbilled rework) → plan → gate → invite → interview. Walk tenant is
  meridian-print-works, hidden from the picker, kept as evidence.

**One decision waiting on you + Emre:** the invite email's locked consent line still
promises "you'll review anything attributed to you by name" while the interviewer and
consent page promise flat anonymity with naming only if the respondent asks. One wording
ruling aligns them; I didn't touch locked compliance copy.

**Human confirmation still open:** a real-mic voice call (your Hear-it-live). Everything
around it — webhook attribution, fallback to text, watchdog — is verified.
