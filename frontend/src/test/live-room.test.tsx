import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveRoom } from "@/components/interview/LiveRoom";

// R1 audience split (Kaan): the respondent room shows ONLY that capture is happening — a
// bare count + the extraction heartbeat — never the captured items. LiveRoom is the
// respondent frame; these pin that it renders a count and has no item-content surface, and
// that a simulation suppresses the readout entirely.

function room(props: Partial<React.ComponentProps<typeof LiveRoom>> = {}) {
  return (
    <LiveRoom
      header={<div>header</div>}
      controls={<div>controls</div>}
      capturedCount={21}
      capturing={false}
      {...props}
    >
      <div>transcript</div>
    </LiveRoom>
  );
}

describe("LiveRoom — respondent capture readout (R1)", () => {
  it("shows a bare capture count, not item content", () => {
    render(room({ capturedCount: 21 }));
    expect(screen.getByText(/21 items captured/i)).toBeInTheDocument();
  });

  it("singularizes the count", () => {
    render(room({ capturedCount: 1 }));
    expect(screen.getByText(/1 item captured/i)).toBeInTheDocument();
  });

  it("suppresses the readout entirely in a simulation", () => {
    render(room({ capturedCount: 21, hideCaptured: true }));
    expect(screen.queryByText(/captured/i)).toBeNull();
  });

  it("still renders the conversation and controls", () => {
    render(room());
    expect(screen.getByText("transcript")).toBeInTheDocument();
    expect(screen.getByText("controls")).toBeInTheDocument();
  });
});

// ROOM-PARITY: the agent-state rail (vertical StateTimeline) is the respondent-side spec
// (KAAN-RULINGS R1). It renders when an agentState is provided, stays counts-only (states +
// count, never item content), and is suppressed in a simulation.
describe("LiveRoom — agent-state rail (ROOM-PARITY / R1)", () => {
  it("renders the vertical state timeline when an agentState is given", () => {
    render(room({ agentState: "listening" }));
    // The rail shows the base spine labels; the count still rides in the rail footer.
    expect(screen.getByText("Listening")).toBeInTheDocument();
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("Speaking")).toBeInTheDocument();
    expect(screen.getAllByText(/21 items captured/i).length).toBeGreaterThan(0);
  });

  it("appends reconnect events to the rail in order", () => {
    render(room({ agentState: "reconnected", connectionEvents: ["reconnecting", "reconnected"] }));
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
    expect(screen.getByText("Reconnected")).toBeInTheDocument();
  });

  it("does not render the rail without an agentState", () => {
    render(room());
    expect(screen.queryByText("Listening")).toBeNull();
  });

  it("suppresses the rail in a simulation even with an agentState", () => {
    render(room({ agentState: "listening", hideCaptured: true }));
    expect(screen.queryByText("Listening")).toBeNull();
    expect(screen.queryByText(/captured/i)).toBeNull();
  });
});
