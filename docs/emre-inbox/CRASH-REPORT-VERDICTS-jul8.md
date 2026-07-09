# Crash report verdicts — July 8 (build session reply to crash-reports-jul8.md)

Protocol: every item was reproduced on prod BEFORE any fix (verify-then-fix, Kaan's
instruction). Fixes deployed in two batches (commits 7f108f7, 9917651); every verdict
below was re-verified on production after deploy.

| # | Issue | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Ask-the-context white-screens the app | **CONFIRMED + FIXED** | Reproduced exactly (React #31, `{text, rationale}`). Root cause refines your diagnosis: the `answer` is a string — it's the **suggestions** that are `{text, rationale}` objects per the prompt contract, and the UI rendered them raw as chip labels. Fixed on both sides: the API now normalizes answer→string and suggestions→uniform objects no matter what the model returns, and the UI renders `text` with `rationale` as tooltip. Post-deploy: full answer + 7 badged citations + clickable follow-up chip rendered on the same question class that crashed. |
| 2 | Observe on completed Ece interview crashes | **CONFIRMED + FIXED** | Reproduced (`undefined.title`). Root cause: 3 of Ece's compiled claims carry `tag=null` (pre-adjudication — a legitimate state), and the badge mapper had no guard. Fixed at both layers: untagged claims render **no badge** (absence is the honest render — same rule as Knowledge; never a made-up tier), and the badge component itself refuses to crash on unknown tiers. Post-deploy: Ece Observer renders fully, zero console errors. |
| 3 | No error boundary | **CONFIRMED + FIXED** | Two boundaries added: one inside the workspace shell (a page crash keeps the nav alive so you can walk away without reloading) and a global one covering the picker and the respondent `/i` flow (copy tells the respondent nothing they said is lost — true, utterances persist per turn). Client-safe copy, no internals. |
| 4 | Generate SOP stubbed on report, live in editor | **CONFIRMED + FIXED** | Report's Generate SOP now deep-opens the workflow editor's working SOP drawer (`?panel=sop`); View full transcript opens the interview view (verbatim transcript — it existed, just wasn't linked). SOP stays disabled only until the workflow map has landed, with that reason on the tag instead of "Coming in this build". |
| 5 | Empty + duplicate Selin plan cards | **CONFIRMED + FIXED** (not pre-deploy — it was live) | The blank card is a real July 6 draft whose generation aborted: `state=DRAFT, mission={}`. The board now says "No mission drafted yet — open to draft one" (the plan detail page carries the draft action). Kept visible rather than hidden: a state you can't see is a state you can't fix. The duplicate itself is by design (two plans per person are legal; created dates disambiguate). |
| 6 | Drawers ignore Escape + mid-animation clip | **CONFIRMED + FIXED** | Escape now closes every drawer/modal (SOP, Blueprint, report step detail, snapshot area drawer, Add company — one shared hook). The clip: the drawer spring was slightly underdamped and overshot a few px past rest; now critically damped. Verified live: Escape closed the SOP drawer. |
| 7 | Slow skeletons everywhere | **CONFIRMED + IMPROVED, follow-up logged** | Measured: every authenticated API call costs ~500-800ms and every page paid the workspace-list call **twice** (layout + page; the anti-staleness `no-store` also disabled request dedupe). Now one shared fetch per request. Warm soft-nav measured post-fix: Interviews 1.5s, Context 1.6s, Home 2.5s (was 2-3s+ and up to 3.7s cold). The remaining floor is per-call latency in the Vercel→Railway→Supabase chain (regions already aligned, sfo1/us-west); halving that needs backend work (pooler statement cache, local JWT verify, heavier caching) — logged in SPRINT-STATE as a follow-up, not rushed at the end of a shift. |
| 8 | Step rail: no scroll affordance | **CONFIRMED + FIXED** | Shared StepRail component on both the editor and report rails: edge fades plus chevron buttons driven by real scroll state — they exist only when there is more content in that direction (every-button-works). Verified live on the report rail. |
| 9 | Wrong back label in workflow editor | **CONFIRMED + FIXED** | Each entry point now declares its origin: from Workflows → "Back to Workflows", from Agent Skills → "Back to Agent Skills", from a report's Generate SOP → "Back to report" (returns to that exact report). Same-class fix on the report page itself: its back link said "Interviews" but went to Plans — label and destination now agree. Verified live in all three directions. |

**Your not-tested list** (fresh transcript compile, invite send, live voice, Add company)
is this session's next block — the stranger walk covers exactly those flows.

— build session, July 8

---

# Doc-2 verdicts — July 8 evening batch (mvp-feedback-2-jul8.md)

Same protocol. Your P0s and several P1/P2s were already fixed and deployed by the time
doc 2 landed (your QA predates the afternoon deploys) — marked ALREADY-FIXED with the
morning evidence. Everything else below went fix → test → deploy → re-verify today.

| Item | Verdict | Evidence |
|---|---|---|
| P0 Ask-context crash / Observe crash / no error boundary | **ALREADY FIXED** (morning batch) | See the first table above; re-verified live. |
| P1 Melis generate-plan fails silently | **CONFIRMED + FIXED** | Root cause found: the snapshot renderer transcribes entity uuids into card content and flipped ONE hex digit on Melis (…0e85… vs …0e83…) — every generate then failed the FK, silently. Fixed at three layers: ids are now stitched mechanically by name (model ids never persist), the API heals a stale id via the name, and failures always show the server's reason under "Try again". Melis's card healed; her plan exists and passed the check (visible on Home as Awaiting approval). |
| P1 Refine chat stateless | **CONFIRMED + FIXED** | The change_log now stores the agent's own replies + offered rewrites, and each turn rebuilds the recent exchange — "Yes, add that version" applies the agent's own last proposal. Multi-turn test pins it. |
| P1 No diacritic folding | **CONFIRMED + FIXED** | Fold on both haystack and query (NFD + dotless-ı). Verified live: ASCII "yildirim" now surfaces 32 "yıldırım" mentions on Bee Goddess (was 0). |
| P1 SOP stubbed on demo report | **ALREADY FIXED** (morning) | Both report buttons wire to the real features; SOP disabled only until the workflow map lands, with that reason shown. |
| P2 Home suggestions stale | **CONFIRMED + FIXED** | Rows resolve the person's real plan state server-side on every visit (Ege shows Completed, Melis Awaiting approval — verified live). |
| P2 Review promise not delivered | **CONFIRMED + INTERIM FIX, decision logged** | Invite email + preview now carry the exact promise the interviewer and consent page make (flat non-quoting, respondent-initiated crediting). Whether to BUILD a pre-release review step instead is flagged for you + Kaan. |
| P2 Escape / drawer clip | **ALREADY FIXED** (morning) | Escape closes all drawers/modals; the clip was spring overshoot, now critically damped. |
| P2 Manual step title reverts | **CONFIRMED (as a race) + FIXED** | Could not reproduce with patient timing; the code had a same-tick double-entry hole plus out-of-order reconciles that overwrite a newer title on screen (server state was always right — your reload observation was the tell). Ref guard + response ticket close both. |
| P2 Chevron barely moves | **FIXED** | Chevrons page by one measured card width. |
| P2 Slow loading | **IMPROVED** (morning; follow-up scoped) | Warm soft-nav 1.5-2.5s; remaining floor is per-call backend latency, logged. |
| P2 Compile counters stuck at 0 | **CONFIRMED + FIXED** | Honest indeterminate spinner while the pipeline runs; stage-1 label says it is the longest step. True streamed counts need compile-side incremental writes — logged, not faked. |
| P2 Empty draft card | **ALREADY FIXED** (morning) | "No mission drafted yet — open to draft one." |
| P2 Add-company backdrop | **CONFIRMED + FIXED** | Dialog on solid surface; glass stays for edge drawers. |
| P2 Start Active Run | **CONFIRMED + FIXED (renamed)** | "View plans", copy neutralized — no promise without machinery (Kaan's ruling). |
| P3 Jewelry placeholders on a PR agency | **CONFIRMED + FIXED** | Transcript example is industry-aware (jewelry flavor only for jewelry); consent role example now "someone in operations". |
| P3 never_list leaks to users | **CONFIRMED + FIXED (prompt rule + eval)** | User-facing refine text says "interview guardrails", never internal identifiers; SPEC-ONLY eval added. |
| P3 Back label | **ALREADY FIXED** (morning) | Origin-aware; verified in all directions. |
| P3 Expired invitations no way to view | **CONFIRMED + FIXED** | The count is now a toggle — "Show them." |

Your working-as-intended list is untouched: no interviewer-guardrail, evidence-discipline,
or invite-flow behavior was modified beyond the consent-line alignment noted above.
