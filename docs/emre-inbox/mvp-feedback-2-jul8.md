Nexus MVP feedback
nexus-v2-alpha.vercel.app
Context for the model reading this: full manual QA pass on July 8, 2026, Chrome desktop (about 1550px viewport), account emrekuraner@gmail.com. Two workspaces exercised: bee-goddess-demo (seeded demo data) and time-pr (fresh compile from a test transcript). Every nav section, the full interview lifecycle, and the interviewer agent itself were tested. Fix items are ordered by severity. Do not change behaviors listed under “Working as intended.”
P0: crashes (app white-screens, requires reload)
	•	Ask the company context crashes the app.
	•	Repro: Company Context > type any question > Enter or Ask.
	•	Console: Minified React error #31, object with keys {text, rationale}.
	•	Cause: the answer payload {text, rationale} is rendered directly as a React child. Render answer.text and answer.rationale as strings.
	•	Observe on a completed interview crashes the app.
	•	Repro: Interviews (bee-goddess-demo) > Observe on the completed Ece row.
	•	Console: TypeError: Cannot read properties of undefined (reading 'title') in the observe view.
	•	Cause: completed interviews lack a field the observe component expects. Add a guard / fallback.
	•	No error boundary. Both crashes take down the entire app instead of one component. Wrap route content in a React error boundary so any future render error degrades to an inline error card.
P1: broken functionality
	•	Generate plan fails persistently for one suggested person, silently. Repro: time-pr Home > Suggested People > Generate plan on Melis. Fails, button becomes “Try again”; retried 3x, always fails. Ege succeeded with the identical flow. No error message, no console error, no toast. Needs: surface the server error to the user, and investigate why this person's payload fails (likely data-specific).
	•	Refine Plan chat is stateless across turns. Repro: Plan > Refine chat > agent proposes a rewritten question > reply “Yes, add that version.” Actual: “I cannot apply this instruction yet because there is no prior version visible in this conversation.” The agent cannot reference its own previous message. Feed prior turns (at least its own last proposal) into the request context. Pasting the exact text works, so the apply path is fine.
	•	Search has no Unicode/diacritic folding. Repro: Company Context search “yildirim” returns 0 records, though multiple records contain “yıldırım”. Normalize both index and query (ICU folding, or at minimum Turkish ı/i, ş/s, ğ/g, ü/u, ö/o, ç/c). Critical for the Turkish SMB market.
	•	Report-page Generate SOP / View full transcript stubbed on demo data but live elsewhere. Old demo report (Ece, bee-goddess): both buttons disabled “Coming in this build”. Fresh report (Ege, time-pr) and the workflow editor: Generate SOP works. Make state consistent; a disabled stub next to a working identical button reads as broken.
P2: state and UX defects
	•	Home suggestion list goes stale. After Ege's plan was generated, approved, sent, and completed, time-pr Home still shows “Generate plan” for Ege. Refetch or invalidate on plan-state change.
	•	Interviewee review promise not delivered. Invite/landing copy: “Before anything is attributed to you by name, you'll get to review it.” Finishing the interview goes straight to thank-you with no review step. Either build the review step or soften the copy; right now it is a broken promise on a consent surface.
	•	Escape doesn't close side drawers (SOP, Skill Blueprint). Only X or backdrop click. Add an Escape handler; drawer content also renders clipped mid-animation.
	•	Manual step title stale render. After editing the title and toggling Show/Hide hidden, the card reverts to “New manual step” on screen; the correct title reappears after reload. Local state not synced after the toggle.
	•	Workflow rail chevron barely moves. The right chevron advances a few pixels per click; users will think it is broken. Page by one card width. Trackpad horizontal scroll works.
	•	Slow perceived loading everywhere. Most navigations show 2 to 3 seconds of skeletons; the interviews list renders rows half-faded. Data volume is tiny; likely sequential fetches. Parallelize and cache.
	•	Compile progress counters stuck at 0 for about 60 seconds during “Reading the transcript” while work is clearly happening (total compile about 3.5 minutes). Stream incremental counts or add an indeterminate state.
	•	Empty draft plan card. Plans board (bee-goddess) shows a Selin draft with no mission text, next to a second Selin plan. Hide empty drafts or label them.
	•	Add-company modal backdrop too transparent. Background text and buttons bleed through the dialog surface.
	•	“Start Active Run” only navigates to the plans board. Nothing else observable happens; the copy promises an orchestrated run. Either wire it up or rename it.
P3: copy issues
	•	Time PR (a PR agency) shows the jewelry demo placeholder transcript (“metal prices”, “Deniz reprices...”) in the transcript box. The placeholder should be vertical-appropriate or generic.
	•	Interviewee landing page example “someone in packing” is the wrong vertical for a PR agency. Parameterize by industry.
	•	The refine agent's refusal leaks internal jargon to the user: “The never_list blocks...”. Rename in user-facing text (“interview guardrails” or similar).
	•	The workflow editor back link always says “Back to Interviews” even when arriving from Workflows.
	•	Interviews list footer “7 expired invitations hidden” offers no way to view them.
Working as intended: do not regress
	•	Transcript-to-snapshot compile: caught a planted client-count contradiction (15 vs 14) as a perception gap, flagged a hedged claim (“we track it loosely”) as low confidence, ranked a single-person dependency as top pain, extracted all 3 mentioned people with correct roles and interview rationale. Website-scan records merge with a distinct “Scraped” trust tag.
	•	Interviewer agent guardrails passed adversarial probes: refused to validate gossip about a named colleague and kept it out of the report; ignored flattery; declined comparison with the CEO (“I'm only here for your version”); deflected an off-topic tangent in one line; did not cave to a false “I never said that” correction (restated what was heard, invited correction); asks example-first questions; graceful pause and exit with a resumable link.
	•	Post-interview report: leadership-vs-floor and perception-gap cards with “What differs” analysis; Interview Quality honestly scored an evasive session 1/6 objectives (17%), “3 marked partial-dodged”.
	•	Refine Plan agent correctly refused an out-of-scope, client-identifying question and offered a compliant rewrite; applied it as a new suggested question when given exact text; changes logged.
	•	Evidence discipline throughout: records never edited or merged, user-added context capped at “Claimed” trust, workflow edits are audited overlays, manual steps tagged MANUAL and persist.
	•	Invite flow: locked purpose block, consent language, per-person tracking (Sent / Opened / In progress / Completed), no-decline design.
	•	Visual identity (cream/orange palette, serif display type) is distinctive and consistent. Keep it.
Not tested
Voice interview (live call), “Hear it live” test call, Fireflies import, .txt/.md upload, second-transcript compile into an existing snapshot, sign-out/sign-in cycle, mobile viewport.
