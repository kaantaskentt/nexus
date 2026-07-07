import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewProgress } from "@/components/interview/InterviewProgress";
import { LiveTranscript } from "@/components/interview/LiveTranscript";

// A18 (BINDING): the respondent-side live progress must be NEUTRAL. It shows process
// state (listening/thinking/speaking) and time remaining — NEVER a claims/capture ticker.
// Showing capture as a person speaks causes self-censorship (observer effect). These tests
// pin that guarantee so no future change can silently leak captured content onto the
// respondent surface.

// Words that would signal live capture — none of these may ever reach the respondent.
const CAPTURE_LEAK = /claim|captured|capturing|extracted|record(ed|s)?\b|point(s)? (captured|logged)|logged|insight/i;

describe("InterviewProgress — A18 respondent neutrality", () => {
  it("shows a neutral process state and time remaining", () => {
    render(<InterviewProgress state="listening" elapsedSec={300} estSec={1200} />);
    expect(screen.getByText("Listening")).toBeInTheDocument();
    // 15 min - 5 min elapsed => about 15 min left of the 20-min estimate.
    expect(screen.getByText(/min left/)).toBeInTheDocument();
  });

  it("never renders capture/claims wording, in any state", () => {
    for (const state of ["connecting", "listening", "thinking", "speaking"] as const) {
      const { container, unmount } = render(
        <InterviewProgress state={state} elapsedSec={120} estSec={1200} />,
      );
      expect(container.textContent ?? "").not.toMatch(CAPTURE_LEAK);
      unmount();
    }
  });

  it("EMRE-SEAM: renders nothing extra when coverage is undefined (the honest default)", () => {
    render(<InterviewProgress state="listening" elapsedSec={0} estSec={1200} />);
    expect(screen.queryByText(/area \d+ of \d+/i)).toBeNull();
  });

  it("EMRE-SEAM: when a neutral coverage signal is supplied, it shows only a neutral area count", () => {
    const { container } = render(
      <InterviewProgress
        state="thinking"
        elapsedSec={200}
        estSec={1200}
        coverage={{ covered: 2, total: 5 }}
      />,
    );
    expect(screen.getByText(/area 2 of 5/i)).toBeInTheDocument();
    // Still neutral: a topic count is fine; capture wording is not.
    expect(container.textContent ?? "").not.toMatch(CAPTURE_LEAK);
  });
});

describe("LiveTranscript — real turns only", () => {
  it("renders the real turns it is given, nothing invented", () => {
    render(
      <LiveTranscript
        turns={[
          { role: "assistant", text: "How does an order come in?" },
          { role: "user", text: "Usually a WhatsApp message." },
        ]}
        partial={null}
      />,
    );
    expect(screen.getByText("How does an order come in?")).toBeInTheDocument();
    expect(screen.getByText("Usually a WhatsApp message.")).toBeInTheDocument();
  });

  it("shows an honest empty hint before any transcript arrives", () => {
    render(<LiveTranscript turns={[]} partial={null} />);
    expect(screen.getByText(/will appear here as you talk/i)).toBeInTheDocument();
  });
});
