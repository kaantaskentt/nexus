import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { WorkflowsList } from "@/components/workflow/WorkflowsList";
import type { WorkflowSummary } from "@/lib/live";

// SIMPLIFY C (task #5): the list shows an "All" chip plus a chip ONLY for departments that
// exist in this workspace (never a fixed Sales/Marketing tab), a null department stays under
// All, and clicking a chip filters the rows. Confidence + description come straight from the
// server row.

const wf = (over: Partial<WorkflowSummary>): WorkflowSummary => ({
  workflow_id: Math.random().toString(36).slice(2),
  name: "WF",
  session_id: null,
  step_count: 3,
  description: null,
  department: null,
  confidence: null,
  updated_at: new Date().toISOString(),
  ...over,
});

const rows = [
  wf({ name: "Daily Gold Repricing", department: "Operations", description: "Reprice gold each morning.", confidence: "high" }),
  wf({ name: "Online Order Fulfilment", department: "Sales", confidence: "medium" }),
  wf({ name: "Unclassified Flow", department: null, confidence: "low" }),
];

describe("WorkflowsList", () => {
  it("renders a chip only for departments that exist, plus All", () => {
    render(<WorkflowsList slug="bee" workflows={rows} />);
    expect(screen.getByRole("button", { name: /All/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Operations/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sales/ })).toBeTruthy();
    // no workflow is Marketing → no Marketing chip
    expect(screen.queryByRole("button", { name: /Marketing/ })).toBeNull();
  });

  it("filters rows when a department chip is clicked; unclassified only shows under All", () => {
    const { container } = render(<WorkflowsList slug="bee" workflows={rows} />);
    const list = container.querySelector(".divide-y") as HTMLElement;
    // All: every workflow visible, including the unclassified one
    expect(within(list).getByText("Unclassified Flow")).toBeTruthy();
    expect(within(list).getByText("Daily Gold Repricing")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Operations/ }));
    expect(within(list).getByText("Daily Gold Repricing")).toBeTruthy();
    expect(within(list).queryByText("Online Order Fulfilment")).toBeNull();
    expect(within(list).queryByText("Unclassified Flow")).toBeNull();
  });

  it("shows the one-line description and derived confidence", () => {
    render(<WorkflowsList slug="bee" workflows={rows} />);
    expect(screen.getByText("Reprice gold each morning.")).toBeTruthy();
    expect(screen.getAllByText(/High confidence/).length).toBeGreaterThan(0);
  });

  it("renders no chip row when no workflow has a department", () => {
    render(<WorkflowsList slug="bee" workflows={[wf({ name: "Solo", department: null })]} />);
    expect(screen.queryByRole("button", { name: /^All$/ })).toBeNull();
  });
});
