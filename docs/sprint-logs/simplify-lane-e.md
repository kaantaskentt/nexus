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
