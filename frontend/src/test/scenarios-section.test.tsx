import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScenariosSection } from "@/components/simulations/ScenariosSection";
import type { SimulationScenario } from "@/lib/live";

// SIMPLIFY I: the scenario cards render workflow-derived copy and Run mints via workflow_id
// only (the locked contract), then navigates to the room. No archetype/objectives on the card.

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("@/lib/live", () => ({ run_scenario: vi.fn() }));
import { run_scenario } from "@/lib/live";
const runMock = vi.mocked(run_scenario);

const scenarios: SimulationScenario[] = [
  {
    workflow_id: "wf-1",
    label: "Daily Gold Repricing",
    step_count: 9,
    tests_summary: "Daily Gold Repricing — 9 steps, documented exceptions. Tests whether the interviewer surfaces how it handles exceptions.",
    signals: { has_exceptions: true, has_decisions: false, confidence: "medium" },
  },
];

beforeEach(() => {
  push.mockReset();
  runMock.mockReset();
});

describe("ScenariosSection", () => {
  it("renders the workflow-derived card copy, no archetype named", () => {
    render(<ScenariosSection workspaceId="ws-1" scenarios={scenarios} />);
    expect(screen.getByText("Daily Gold Repricing")).toBeTruthy();
    expect(screen.getByText(/Tests whether the interviewer surfaces how it handles exceptions/)).toBeTruthy();
    // the page never names the archetype the admin will play
    expect(screen.queryByText(/Operations Manager|bookkeeper|archetype/i)).toBeNull();
  });

  it("Run mints via workflow_id only, then navigates to the room", async () => {
    runMock.mockResolvedValue({ token: "t", invite_path: "/i/t" });
    render(<ScenariosSection workspaceId="ws-1" scenarios={scenarios} />);
    fireEvent.click(screen.getByRole("button", { name: /Run simulation/ }));
    await waitFor(() => expect(runMock).toHaveBeenCalledWith("ws-1", "wf-1"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/i/t"));
  });

  it("surfaces an error and does not navigate when the mint fails", async () => {
    runMock.mockRejectedValue(new Error("nope"));
    render(<ScenariosSection workspaceId="ws-1" scenarios={scenarios} />);
    fireEvent.click(screen.getByRole("button", { name: /Run simulation/ }));
    await waitFor(() => expect(screen.getByText("nope")).toBeTruthy());
    expect(push).not.toHaveBeenCalled();
  });
});
