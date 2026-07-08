Nexus MVP: what doesn't work
Review of nexus-v2-alpha.vercel.app, July 8, 2026. Tested in Chrome on the Bee Goddess demo workspace. Findings are ordered by severity. Everything not listed here worked as expected.
Blocking bugs
1. Ask the company context crashes the app
Typing a question into the Ask box on the Company Context page and submitting it white-screens the entire app with “Application error: a client-side exception has occurred.” Recovery requires a full page reload.
Console shows React error #31: the component tries to render an object with keys {text, rationale} directly as a React child. The answer payload comes back as a structured object and the render code never unwraps it. The fix is likely one line: render answer.text (and presumably answer.rationale separately) instead of the object itself.
Reproduce: Company Context > type any question > press enter or Ask.
2. Observe on a completed interview crashes the app
Clicking Observe on the completed Ece interview also white-screens the app. Console shows TypeError: Cannot read properties of undefined (reading 'title'). Something the observe view expects on the interview object is missing for completed interviews, and there is no guard.
Reproduce: Interviews > Observe on the Ece row.
3. No error boundary
Both crashes above take down the whole app rather than the failing component. A React error boundary around page content would turn any future crash into a contained error message instead of a blank screen. Worth doing before any client demo, since it caps the damage of every bug in this list and any not yet found.
Functional gaps and inconsistencies
4. Generate SOP is stubbed in one place and live in another
On the post-interview report, Generate SOP and View full transcript are disabled with a “Coming in this build” tag. But the same Generate SOP works from the workflow editor and produces a good SOP. The inconsistency reads as broken rather than staged. Either wire the report buttons to the working feature or remove them from the report until they work.
5. Empty draft plan on the plans board
The Interview Plans board shows a Selin draft card with no mission text at all, next to a second Selin plan that is awaiting approval. Duplicate plans per person plus a blank card makes the board look buggy. Blank drafts should either be hidden or show a clear “draft, not yet generated” state.
UX issues
6. Side drawers ignore Escape
The SOP and Skill Blueprint drawers only close via the X button or clicking the backdrop. Escape does nothing. Small, but it breaks an expectation every desktop user has, and the drawer also renders mid-animation with clipped text if you interact too quickly.
7. Slow perceived loading throughout
Nearly every navigation shows two to three seconds of skeleton placeholders, and the interviews list renders half-faded rows while loading. The data is small; this feels like sequential fetches or unnecessary loading gates. This is the single biggest drag on the product's feel.
8. Workflow editor step rail has no scroll affordance
The horizontal card rail clips the fourth step at the viewport edge with no visible indication that more steps exist to the right. A nine-step workflow will hide most of its steps. Needs a scroll hint, arrows, or a wrap layout.
9. Wrong back label in the workflow editor
The workflow editor always says “Back to Interviews” even when you arrived from the Workflows list.
Not tested
Flows that create real data were left alone: pasting a fresh CEO transcript into Time PR, sending a new interview invitation, the live voice interview, and Add company. These should get a pass before any external demo, especially the transcript-to-snapshot compile since it is the first thing a new client touches.
Summary table
#
Issue
Severity
Effort
1
Ask the company context crashes the app
Critical
Trivial
2
Observe on completed interview crashes the app
Critical
Small
3
No error boundary
High
Small
4
Generate SOP stubbed on report, live in editor
Medium
Small
5
Empty and duplicate plan cards
Medium
Small
6
Drawers ignore Escape
Low
Trivial
7
Slow skeleton loading everywhere
Medium
Medium
8
Step rail clips with no scroll affordance
Medium
Small
9
Wrong back label in workflow editor
Low
Trivial

