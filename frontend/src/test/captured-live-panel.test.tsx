import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapturedLivePanel } from "@/components/interview/CapturedLivePanel";
import { AgentStateIndicator } from "@/components/interview/AgentStateIndicator";
import type { LiveCaptureItem } from "@/lib/liveCaptures";

// SIMPLIFY E — the "Captured live" panel honesty contract (addendum-2 §2 anti-theater +
// A18 respondent neutrality). Two guarantees pinned here so no future change can regress:
//   1. the RESPONDENT view carries NO confidence/ladder badge (badges are admin vocabulary;
//      a respondent-facing surface stays neutral about judgments);
//   2. the panel renders exactly the REAL items it is given — no invented rows, and the
//      "Saving" header reflects the real `extracting` signal, not a canned animation.

function item(over: Partial<LiveCaptureItem> = {}): LiveCaptureItem {
  return {
    id: "1",
    kind: "team",
    label: "Front Desk",
    detail: "A core team in the guest experience.",
    status: "saved",
    created_at: "2026-07-09T17:00:00Z",
    ...over,
  };
}

describe("CapturedLivePanel — respondent neutrality (A18)", () => {
  it("shows the captured item but NO ladder badge on the respondent view", () => {
    render(
      <CapturedLivePanel
        items={[item({ ladder: "reported" })]}
        extracting={false}
        variant="respondent"
      />,
    );
    expect(screen.getByText("Front Desk")).toBeInTheDocument();
    // Even if the payload carries a ladder value, the respondent must never see it.
    expect(screen.queryByText(/reported/i)).toBeNull();
  });

  it("shows the ladder badge on the admin view", () => {
    render(
      <CapturedLivePanel
        items={[item({ ladder: "reported" })]}
        extracting={false}
        variant="admin"
      />,
    );
    expect(screen.getByText("Front Desk")).toBeInTheDocument();
    expect(screen.getAllByText(/reported/i).length).toBeGreaterThan(0);
  });
});

describe("CapturedLivePanel — real items only (anti-theater)", () => {
  it("renders exactly the items given and an honest count", () => {
    render(
      <CapturedLivePanel
        items={[
          item({ id: "a", kind: "system", label: "Opera Cloud", detail: null }),
          item({ id: "b", kind: "goal", label: "Improve guest satisfaction", detail: null }),
        ]}
        extracting={false}
        variant="respondent"
      />,
    );
    expect(screen.getByText("Opera Cloud")).toBeInTheDocument();
    expect(screen.getByText("Improve guest satisfaction")).toBeInTheDocument();
    expect(screen.getByText(/2 items captured/i)).toBeInTheDocument();
  });

  it("shows an honest empty state before anything is captured", () => {
    render(<CapturedLivePanel items={[]} extracting={false} variant="respondent" />);
    expect(screen.getByText(/0 items captured/i)).toBeInTheDocument();
    expect(screen.getByText(/show up here/i)).toBeInTheDocument();
  });

  it("reflects the real extraction signal: 'Saving' only when extracting", () => {
    const { rerender } = render(
      <CapturedLivePanel items={[item()]} extracting={true} variant="respondent" />,
    );
    expect(screen.getByText("Saving")).toBeInTheDocument();
    expect(screen.queryByText("Live")).toBeNull();

    rerender(<CapturedLivePanel items={[item()]} extracting={false} variant="respondent" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText("Saving")).toBeNull();
  });
});

describe("AgentStateIndicator — honest state labels", () => {
  it("renders the current state label", () => {
    const { rerender } = render(<AgentStateIndicator state="listening" />);
    expect(screen.getByText("Listening")).toBeInTheDocument();
    rerender(<AgentStateIndicator state="saving" />);
    expect(screen.getByText("Saving")).toBeInTheDocument();
    rerender(<AgentStateIndicator state="reconnecting" />);
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });
});
