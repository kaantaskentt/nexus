import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObserverView } from "@/components/interview/ObserverView";
import type { ObserverState } from "@/lib/live";

// A19 correction #1 — the audit-eng pin for the Observer's live-badge mapping. The mock
// showed every live insight as "Verified"; that is exactly the lie we do not tell. This
// suite proves the Observer derives every badge through trust.ts/confidenceForTag:
//   - a live observer note (CLAIMED at the data layer) renders as "Reported", never more;
//   - compiled claims render their REAL tag (a VERIFIED one may say Verified — that tier
//     came from the compiler's corroboration, not from this surface);
//   - a GUESS-tagged claim renders as "Reported" (tags never upgrade, non-negotiable #1).
// It complements badge-mapping.test.tsx, which pins confidenceForTag itself.

vi.mock("@/lib/live", async () => {
  const actual = await vi.importActual<typeof import("@/lib/live")>("@/lib/live");
  return { ...actual, observe_session: vi.fn(), add_observer_insight: vi.fn() };
});

function state(over: Partial<ObserverState> = {}): ObserverState {
  return {
    session: {
      id: "s-1",
      status: "active",
      modality: "voice",
      started_at: "2026-07-07T16:00:00Z",
      interviewee: "Deniz Kaya",
      interviewee_role: "Operations",
    },
    utterances: [],
    objectives: ["daily flow"],
    coverage: null,
    coverage_tracking_enabled: false,
    insights: [],
    claims: [],
    ...over,
  };
}

describe("ObserverView badge honesty (A19 correction #1)", () => {
  it("renders a live observer note as Reported — never Verified", () => {
    render(
      <ObserverView
        workspaceId="ws-1"
        sessionId="s-1"
        initial={state({
          insights: [{ id: 1, text: "Orders pile up before lunch.", trust_tag: "CLAIMED", at: "2026-07-07T16:05:00Z" }],
        })}
      />,
    );
    expect(screen.getByText("Orders pile up before lunch.")).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("renders compiled claims with their real ladder tier, and GUESS never upgrades", () => {
    render(
      <ObserverView
        workspaceId="ws-1"
        sessionId="s-1"
        initial={state({
          session: { ...state().session, status: "completed" },
          claims: [
            { id: "c1", text: "Stock counts happen twice a week.", tag: "VERIFIED", evidence_quote: null, at: "2026-07-07T17:00:00Z" },
            { id: "c2", text: "The courier is usually late.", tag: "GUESS", evidence_quote: "I guess he's late most days", at: "2026-07-07T17:01:00Z" },
          ],
        })}
      />,
    );
    // The VERIFIED tier is allowed here BECAUSE it came from the compiled record.
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // The hedged claim renders as Reported — same pill as CLAIMED, no distinct lower tier.
    expect(screen.getByText("Reported")).toBeInTheDocument();
  });

  it("renders an untagged claim (tag=null, pre-adjudication) with no badge and no crash", () => {
    // July 8 crash report #2: Observe on the completed Ece interview white-screened —
    // 3 of its compiled claims carried tag=null and MAP[undefined].title threw.
    render(
      <ObserverView
        workspaceId="ws-1"
        sessionId="s-1"
        initial={state({
          session: { ...state().session, status: "completed" },
          claims: [
            { id: "c1", text: "The morning count is done by hand.", tag: null, evidence_quote: null, at: "2026-07-07T17:00:00Z" },
          ],
        })}
      />,
    );
    expect(screen.getByText("The morning count is done by hand.")).toBeInTheDocument();
    // No badge of any tier — absence is the honest render for an untagged claim.
    for (const label of ["Verified", "High", "Reported", "Scraped"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("says coverage is not tracked instead of faking a ring when the map is null", () => {
    render(<ObserverView workspaceId="ws-1" sessionId="s-1" initial={state()} />);
    expect(screen.getByText(/coverage tracking is off/i)).toBeInTheDocument();
    // The planned topic list still shows, without any covered/uncovered claim.
    expect(screen.getByText("daily flow")).toBeInTheDocument();
  });

  it("renders the engine-computed ring when a real coverage map exists", () => {
    render(
      <ObserverView
        workspaceId="ws-1"
        sessionId="s-1"
        initial={state({
          coverage: {
            objectives: [
              { label: "daily flow", status: "satisfied" },
              { label: "handoffs", status: "partial" },
              { label: "deadline tracking", status: "untouched" },
            ],
          },
          coverage_tracking_enabled: true,
        })}
      />,
    );
    expect(screen.getByRole("img", { name: /1 of 3 topics covered/i })).toBeInTheDocument();
    expect(screen.getByText(/1 covered/)).toBeInTheDocument();
    expect(screen.getByText(/1 partly/)).toBeInTheDocument();
    expect(screen.getByText(/1 not yet/)).toBeInTheDocument();
  });
});
