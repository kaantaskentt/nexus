import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { GeneratePlanButton } from "@/components/snapshot/GeneratePlanButton";
import type { InterviewPlan, PersonRef, PlanState } from "@/lib/types";

// #33: the button must reflect the REAL job state, never fake an "in review" done-state
// the instant generate_plan() returns (that POST only enqueues; the plan is still DRAFT).
// These tests pin the honesty contract: Generating while the plan sits at DRAFT, and the
// "In review" done-state only after the plan genuinely leaves DRAFT (A4: lands NEXUS_CHECK).

vi.mock("@/lib/live", () => ({
  generate_plan: vi.fn(),
  get_plan: vi.fn(),
}));

import { generate_plan, get_plan } from "@/lib/live";

const genMock = vi.mocked(generate_plan);
const getMock = vi.mocked(get_plan);

const person: PersonRef = {
  name: "Burak",
  role: "Production Lead",
  why_line: "holds the peak-season knowledge",
  entity_id: "ent-1",
};

function planAt(state: PlanState): InterviewPlan {
  return {
    id: "plan-1",
    workspace_id: "ws-1",
    round_id: null,
    interviewee_id: null,
    state,
    is_custom_path: false,
    mission: {} as InterviewPlan["mission"],
    suggested_questions: [],
    never_list: [],
    suppressed_flags: [],
    change_log: [],
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
  };
}

function renderButton() {
  return render(<GeneratePlanButton workspaceId="ws-1" slug="acme" person={person} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  genMock.mockReset();
  getMock.mockReset();
  genMock.mockResolvedValue({ plan_id: "plan-1", state: "DRAFT", job_id: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GeneratePlanButton", () => {
  it("starts with a live 'Generate plan' affordance", () => {
    getMock.mockResolvedValue(planAt("NEXUS_CHECK"));
    renderButton();
    expect(screen.getByRole("button", { name: /generate plan/i })).toBeInTheDocument();
  });

  it("shows an honest 'Generating' state while the plan is still DRAFT — never 'In review'", async () => {
    // The job hasn't finished: the plan stays DRAFT across polls.
    getMock.mockResolvedValue(planAt("DRAFT"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /generate plan/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // let the POST + first poll resolve

    expect(screen.getByText("Generating")).toBeInTheDocument();
    expect(screen.queryByText("In review")).toBeNull();

    // Even after several poll cycles, a DRAFT plan must not be dressed as done.
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.queryByText("In review")).toBeNull();
    expect(screen.getByText("Generating")).toBeInTheDocument();
  });

  it("reaches the 'In review' done-state only once the plan leaves DRAFT", async () => {
    // DRAFT for the first two polls, then flips to NEXUS_CHECK.
    getMock
      .mockResolvedValueOnce(planAt("DRAFT"))
      .mockResolvedValueOnce(planAt("DRAFT"))
      .mockResolvedValue(planAt("NEXUS_CHECK"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /generate plan/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Generating")).toBeInTheDocument();

    // Advance past the poll cadence until the state flips.
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    const link = screen.getByRole("link", { name: /in review/i });
    expect(link).toHaveAttribute("href", "/w/acme/plans");
    expect(
      screen.getByText(/reviewing this plan before it reaches you/i),
    ).toBeInTheDocument();
    // A4: no claim that it is ready to send, and no 'decline'/'reject' language.
    expect(screen.queryByText(/ready to send/i)).toBeNull();
  });

  it("surfaces a retryable error state when generation fails to enqueue", async () => {
    genMock.mockRejectedValueOnce(new Error("network"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: /generate plan/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
