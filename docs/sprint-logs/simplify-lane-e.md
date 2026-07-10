# SIMPLIFY lane E — the live room (task #7, E+F)

A28 pre-reviews (two lines each: today → after; simpler-or-more-complex for the user).
Each COMMIT is its own revertable commit, scoped `git commit -- <paths>`.

## COMMIT 1 — live_captures backend (NET-NEW, no existing surface changed)
Today: there is no live extraction; the only "live insights" are admin-typed observer
notes (codemap Area 5). Nothing shows a respondent what Nexus is capturing.
After: a per-turn structural extractor writes session-scoped `live_captures` (teams,
systems, workflows, decision rules, goals, open questions — STRUCTURAL only), read by a
public token-scoped endpoint and an admin variant. Sentiment about named people is
rejected at the data layer; every item needs a verbatim quote span or it is dropped as
invented; items never enter the KB (compile stays the only claim producer).
Simpler for the user: yes — net-new transparency surface, changes no existing flow. It
is additive; the turn path only gains a fire-and-forget enqueue gated to interview/context
kinds (eval/voice_test/roleplay never spawn extraction).
LANDED 0ac212c (core) + 45da288 (text-path enqueue remainder, re-applied on top of
lane-ef's prompt-cache after the shared tree reset my hunks). Voice fires from the webhook
transcript path. Full backend suite green.

## COMMIT 2 — stream the text turn (SSE) [the deferred EF fix #3]
Today: `/turn` returns the whole reply as one JSON body; the respondent watches typing
dots for the entire 3-7s generation (SIMPLIFY-EF-FINDINGS E).
After: `run_chat_stream` (streaming twin of `run_chat`, same cached-system assembly + audit)
+ `stream_interview_turn` + `POST /turn/stream` (SSE). Words appear at first token; dots
only until then. The non-streaming `/turn` stays as the fallback (client re-requests there,
with null when the respondent turn was already stored so it never double-stores). No
half-turn is ever persisted on a mid-stream error.
Simpler for the user: yes — same conversation, latency stops being visible; nothing about
the pipeline contract or the record changes. LANDED 8c3203b (backend) + a1d169c (frontend).

## COMMIT 3 — the room (LiveRoom family) [Kaan taste checkpoint — awaiting bless]
Today: voice (`VoiceCall.tsx`) and text (`InterviewClient` chat branch) are sibling
layouts; there is no "Captured live" surface.
After: ONE `LiveRoom` frame — presence header (voice = Concept A bar; text = Voice off /
Text mode), transcript owns the middle, controls docked, right-side `CapturedLivePanel`
(polls live-captures; "Just added" -> "Saved" arrival on real saved rows; header pulse =
real in-flight extraction), `AgentStateIndicator` derived from real VAPI/SSE events.
Respondent renders shell-less; workspace-side keeps the AppShell nav. Primitives + panel
test are built and green; wiring waits on the layout bless (team-lead relays Kaan).
Simpler for the user: yes — voice and text become one understandable room, and the
respondent can see exactly what was saved.
LANDED: primitives d4140fb; wiring ff60beb (layout blessed via GO-LANE-E.md). VoiceCall's
live screen + InterviewClient's text chat both render LiveRoom; the respondent Shell widens
for the room and collapses the aside to a slide-over sheet below lg. "Saved" check is quiet
(fades, no bounce) per the taste note. Done-page body branches on snapshot_exists (a later
context call no longer claims to be the "first version"). tsc/eslint/vitest green (93).

## COMMIT 4 — in-room reconnect (F)
Today: a dropped voice call swapped the whole screen for a "call dropped" page (transcript
gone from view).
After: the room stays (transcript preserved) and shows an unobtrusive reconnecting banner
(image1/image20) that auto-recovers ONCE, confirms "Reconnected. Back together, continuing
our conversation.", and offers manual "Try again" / "Continue by text". The existing
dropped-vs-ended distinction + mic watchdog are wired in, not rebuilt; pending auto-reconnect
is cancelled if the respondent ends or switches to text; a failed reconnect keeps the room.
Simpler for the user: yes — a blip becomes a quiet line in the room instead of a jarring
full-screen reset, and nothing shared is lost. LANDED efa9702. tsc/eslint/vitest green.

## Not in scope / handed off
- Workspace-side Observer room (admin CapturedLivePanel variant) is lane-k's K4 territory
  (they took ObserverView); the admin `GET /{session_id}/live-captures` endpoint + the
  panel's `variant="admin"` (Reported-at-most badge) are ready for them to consume.
- Root-cause of the voice drops themselves (silence-timeout 30->60, honest empty-turn
  fallback, prompt-cache latency) landed in lane-ef; this lane owns the in-room UX for a drop.

## Task #10 — Simulations Run wiring (lane-e half; page = audit-walk)
Today: /simulations had no runnable scenario; the room had no simulation mode.
After: POST /scenario-run { workflow_id } derives archetype (dept→CAST_KEYS) + interviewer
objectives SERVER-SIDE (injection guard — client-supplied objectives never cross the wire;
a test proves stray body fields are dropped), mints a roleplay-kind session steered to probe
that workflow, and opens the LiveRoom with a persistent "Simulation — practice run, nothing
reaches your company records" marker + suppressed Captured-live panel. The interviewer is
steered but never told it's a drill (the behaviour under test is unchanged). Debrief judges
objective coverage. Firewall unchanged and asserted (compiler skips roleplay). Isolation
(404 foreign workflow) + >=3-step gate. LANDED 3a972a5 (backend, pipeline/scenario.py +
tests) + a75b853 (frontend room adaptation). Contract with audit-walk (workflow_id-only)
committed at 5a1eb6e; their GET /scenarios + page are the other half. Held-then-built after
seam-2 verified the room live, per team-lead. Backend affected suites green (scenario_run,
roleplay, interview, context_call, simulations, turn_stream, live_capture = 35); frontend
tsc 0 / eslint clean / vitest 100.
Simpler for the user: yes — one honest "pressure-test the interviewer against YOUR workflow"
action that reuses the room they already know, clearly marked as practice.
