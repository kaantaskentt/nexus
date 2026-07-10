# LANE ROOM-PARITY — July 10 — visual parity for the live room (Kaan's frustration item)

Owner: lane-sec (reassigned; I own components/interview/** and built the R1 split these sit on).
Scope: docs/ROOM-PARITY-ANYTIME-orders.md §ROOM-PARITY (display-only, A28 per surface, NO
behavior change). lane-quality builds ANYTIME-CONTEXT in parallel and reuses my room UNTOUCHED.

## HARD CONSTRAINTS (carry from R1 — do not regress)
- R1 holds exactly: ADMIN/observer shell gets the content cards; RESPONDENT shell stays
  counts-only (the count pill). Parity applies to BOTH shells' VISUALS, never their data.
- Sim marker stays; simulation room keeps counts-only + the practice-run marker.
- Display-layer only: no pipeline/persona/capture/by-token payload changes.

## REFERENCE GAP (flagged to team-lead)
The orders point to docs/kaan-inbox/room-mockups/ (the "4 screenshots") — that dir is EMPTY,
never committed. FEEDBACK.md's welcome mock is literally "(Place Alternative UI Here)" text,
and its media/image11 is the Plan page, not a room mockup. So there are NO pixel mockups in
the repo. The orders' TEXT is detailed (6 items) and team-lead pre-authorized the text-spec
fallback ("otherwise the mockups are the spec; flag ambiguous calls, don't guess"). Proceeding
on: orders text + the existing (taste-approved A19/SIMPLIFY-E) components + the Nexus token
system + current prod state. Pixel-exact calls flagged, not guessed. Asked team-lead for the
Figma file link (Kaan's file) in case the real mockups live there.

## CURRENT-STATE ASSESSMENT (what actually renders today)
- **Presence orb**: `ParticleOrb` (700-pt particle sphere, real-signal, taste-approved A19)
  EXISTS and renders in VoiceCall. BUT the context-call WELCOME (`ConsentLanding`) has NO orb
  at all. Gap: welcome hero orb missing.
- **Agent-state rail**: `StateTimeline` (vertical Listening/Thinking/Saving/Speaking + appended
  reconnect events, clean dots + active highlight) is BUILT but MOUNTED NOWHERE. The rooms show
  only the compact one-line `AgentStateIndicator`. Gap: the vertical rail (mockup item 3) is not
  shown anywhere. Biggest concrete win.
- **Captured-live cards**: `CapturedLivePanel` already has icon tiles + "Just added"(spinner)/
  "Saved"(check) + count footer. Admin-only (R1). Footer shows count; orders show "· 82%"
  (coverage) — coverage is admin vocabulary and dormant (coverage_routing off), so I will NOT
  fabricate a %; flag.
- **Reconnect pills**: `ReconnectBanner` exists (trying/recovered) — reasonable but flat; orders
  want "card" styling (mockup 4). Polish.
- **Welcome 3-box**: `ConsentLanding` = heading + intro + TWO stacked `Block` cards (what-it-is /
  handling) + one button. Orders want THREE boxes (What Nexus will learn / After the call /
  Privacy) + hero orb + a "Preview questions" secondary button + calmer spacing. The 3rd box
  ("After the call") needs copy from consentCopy() — copy is locked-compliance territory; I will
  restructure DISPLAY and reuse existing copy, flag any net-new consent sentence for Kaan+Emre.
- **Sim/real/context = one family**: LiveRoom already the shared frame (sim uses hideCaptured +
  marker). Parity comes for free once the family is polished; verify the sim room at the end.

## Per-surface plan (A28 pre-review each, own revertable commit, verify 1440+390)
1. Mount `StateTimeline` vertical rail (admin/observer presence area + voice presence) — the
   built-but-unmounted rail. Respondent shell keeps the compact line + count pill (R1 calm).
2. Context-call welcome hero orb + 3-box restructure + Preview-questions button (display only).
3. Captured-live card polish to mockup (icon tile / states / footer), admin shell only.
4. Reconnect pills → card styling (mockup 4).
5. Presence orb usage audit (ensure no "bare disc" path; welcome + both rooms use ParticleOrb).
6. Sim-room parity pass + both-width verify.

## A28 pre-reviews
- **Surface 2 (context-call welcome hero orb) — LANDED.** Today: ConsentLanding is text-only
  (heading + intro + 2 cards), a cold open. After: a calm hero ParticleOrb (state="listening",
  volume 0) sits above the heading on the CONTEXT-CALL welcome only (session.context_call);
  employee-interview welcome unchanged. Reuses the exact dark-tile orb pattern proven on the
  connecting screen. Simpler/complex? Slightly richer, calmer, on-brand; additive, no
  interaction change. tsc clean. Orb SIZE (h-36→sm:h-44) is a sensible default — confirm in the
  browser 1440/390 pass; flagged pending mockup.

## Team-lead rulings (UNBLOCKED the holds)
1. StateTimeline placement is NOT a taste guess — KAAN-RULINGS R1 specifies the respondent
   room shows the vertical agent-state rail, REPLACING the compact one-liner. Admin/observer
   may also mount it. Only pixel styling waits for mockups.
2. Welcome 3rd-box copy: visual-only, reuse existing consentCopy re-grouped; 2 boxes + flag if
   it can't be honestly filled. Net-new sentence = Kaan+Emre locked.
3. Never fabricate the % — "N items captured" only.
4. Reconnect pills + captured-card polish: build sensible-default token styling NOW, flag
   pixel-exact per surface.
5. Mockups confirmed missing (#1 on Kaan's unblock list). Pixel-reconcile when they land.
6. Browser FREE.

## A28 pre-review — Surface 1 (respondent agent-state rail) — LANDED
- Today: respondent room shows a compact one-line AgentStateIndicator + a count pill; the built
  StateTimeline vertical rail renders nowhere.
- After: LiveRoom gains a DESKTOP right rail = vertical StateTimeline (current highlighted,
  reconnect events appended) + the count in its footer. Below lg the room stays single-column
  with the compact line + count above controls. Both text (roomState) and voice
  (orbState→rail mapping) wired. Counts-only — states + number, NEVER content; R1 data layer
  untouched; sim suppresses it.
- Simpler/complex? Richer on desktop but the specified R1 design (rail replaces the one-liner).
  Rail width/placement/labels are a sensible default, flagged pending mockups.
- Verify: tsc clean; 8/8 live-room.test.tsx incl. 4 NEW rail tests (renders on agentState,
  appends reconnect events, absent without agentState, suppressed in sim). VISUAL 1440/390
  deferred to prod post-seam-C (build not deployed; local frontend can't reach the prod backend
  — CORS locks it to nexus-v2-alpha), same as R1's driven pattern.

## Sensible-default pass — outcome per surface (all buildable wins landed)
- **Surface 4 captured-cards** — AT BAR: the admin CapturedLivePanel already has icon tiles +
  Just-added/Saved + count footer (built to standard in SIMPLIFY E). The mockup's "waveform"
  footer is a respondent-mic element that doesn't apply to the admin observer (no mic; R1 keeps
  the respondent counts-only). No honest sensible-default change; exact polish pending mockup.
- **Welcome 3-box = 2 boxes + FLAG (ruling 2):** the context-call consentCopy is two honest,
  LOCKED + sync-guarded groups (whatItIs / handling-6-sentences). A 3rd "After the call" box
  needs NEW locked copy (Kaan+Emre) or splitting the locked array at a guessed point — neither
  fills it honestly, so it stays 2 boxes. **"Preview questions" button = FLAG:** an unbuilt
  FEATURE, not display polish (a dead button would be dishonest). Both need Kaan.
- **Presence-orb audit** — no bare-disc path: connecting screen, live voice presence, and the
  welcome all use ParticleOrb. TEXT mode has the rail, no orb; whether the text rail carries a
  small orb is a taste/size call = FLAG for the mockup.
- **Sim parity** — the sim room uses the same family (hideCaptured suppresses rail + count;
  practice-run marker stays). Verify at the seam-C gate.

## Seam-C1 GATE walk — DONE, PASS both widths (deployed 660db57 on nexus-v2-alpha)
Drove a disposable hidden context session (workspace 6f824daf, is_internal) on prod, viewed the
real deployed room at 1440 + 390:
- **Welcome hero orb** — PASS 1440 + 390: welcome opens on the centered particle orb above the
  heading; boxes + button stack cleanly, no overflow, calm/legible.
- **Agent-state rail** — PASS 1440 (right "Nexus" rail: vertical Listening/Thinking/Saving/
  Speaking, active highlighted + "3 items captured" footer, counts-only) and 390 (rail hidden,
  compact "Listening" line returns in header + count above composer, no overflow). R1 held.
- **Reconnect cards** — code-verified (tsc); visual not driven (a voice drop is hard to force),
  styling-only.
No composition/overflow/legibility FAILURES. One pixel-pending note (mockup, not a gate fail):
the 1440 rail count sits at the bottom (matches the CapturedLivePanel footer pattern), slightly
sparse with only 4 state rows — final rail composition waits on the mockup. With SIGHT the 2-box
welcome reads clean; the 3rd "After the call" box stays a copy decision (ruling 2), confirmed.
Screenshots: scratchpad/parity-screens/. Teardown: workspace 6f824daf left is_internal for reap.

## A28 pre-review — Surface 3 (reconnect pills → cards) — LANDED
- Today: ReconnectBanner is a flat rounded-md bordered strip (trying / recovered).
- After: calm CARD treatment (rounded-card, card-hairline, shadow-elev-1, icon in a rounded
  tile) per mockup 4. Copy, buttons, behaviour unchanged — display only. tsc clean.
- Simpler/complex? Same info, slightly more finished; no interaction change. Pixel-exact
  flagged pending mockups.

## Kaan welcome-copy fix (watchtower) — PREPPED, awaiting team-lead file routing
Kaan finds the current welcome intro too verbose ("A working conversation about {company}…
not a tidy version of it"). Crisp mockup-2 copy he wants:
- eyebrow: "COMPANY CONTEXT CALL" · headline: "Company context call"
- subtitle: "Build Nexus's first understanding of {company}."
- one line: "A 20–30 minute conversation to capture how your company works, what matters, and
  where Nexus can add the most value." · DROP the "tidy version of it" sentence.
Blast radius: strings live in consentCopy() (frontend/src/lib/respondent.ts) synced to
prompts/personas/consent-landing.md by evals/consent_copy_sync.py — BOTH are lane-s7's active
files (they just shipped the S7.8 line, b04c659). I own only the ConsentLanding component layout.
Sync-guard analysis: the guard checks plain double-quoted strings ≥25 chars; the subtitle is
templated (${company}) → skipped, label/headline are short → skipped, but the one-line intro is
FIXED copy ≥25 chars → it MUST be added to consent-landing.md (context-call section). So the edit
needs both lane-s7 files. Requested team-lead routing: (a) grant me the header region (leave the
S7.8 line + all box promises byte-untouched, run the guard green) or (b) route strings to lane-s7.
I execute (a) on grant: change header framing only, keep the 2 compliance boxes + hero orb.
Kaan feedback logged: use a REALISTIC demo workspace name (e.g. a hotel) in anything screenshot-
visible, never "X (internal)".

## Verdicts
- Surface 2 (welcome hero orb) 747fd27. Surface 1 (agent-state rail) 1dda84c, test-green.
  Surface 3 (reconnect cards) 660db57. Seam-C1 gate walk PASS both widths (82befa4).
  Kaan welcome-copy fix prepped, blocked on team-lead file routing.
