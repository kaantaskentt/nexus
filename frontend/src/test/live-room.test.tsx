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
