import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// SIMPLIFY §4-J: "Play this character" opens a legible Overview (default) with the raw
// technical sheet still one tab away verbatim. These tests drive the real dialog: click
// Play → assert the Overview relabels the sheet's sections and the CEO-facing facts show,
// and that "Full brief" still renders the raw markdown untouched.

vi.mock("@/lib/live", () => ({
  start_roleplay: vi.fn(),
  get_roleplay_brief: vi.fn(),
  list_roleplay: vi.fn(),
  request_roleplay_debrief: vi.fn(),
}));

import { start_roleplay, get_roleplay_brief, list_roleplay } from "@/lib/live";
import { RolePlaySection } from "@/components/simulations/RolePlaySection";

const startMock = vi.mocked(start_roleplay);
const briefMock = vi.mocked(get_roleplay_brief);
const listMock = vi.mocked(list_roleplay);

const SHEET = `# You are Lale Aksu — Operations Manager, Serein Fine Jewelry

You are proud of the house's craft.

## How you speak (PROUD MAKER)
- You lead with craft and pride.

## Hidden knowledge — do NOT volunteer
- **H1 — the rework loop.** One in five comes back from QA.`;

const cast = [
  { key: "jewelry-ops-manager", role: "Operations Manager", style: "Proud maker", tests: "episode anchoring" },
];

beforeEach(() => {
  startMock.mockReset().mockResolvedValue({ token: "t1", invite_path: "/i/t1" });
  briefMock.mockReset().mockResolvedValue({ key: "jewelry-ops-manager", cast: cast[0], sheet: SHEET });
  listMock.mockReset().mockResolvedValue([]);
});

async function openBrief() {
  render(<RolePlaySection workspaceId="ws-1" cast={cast} initialRuns={[]} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /play this character/i }));
  });
}

describe("RolePlaySection brief dialog", () => {
  it("opens on the Overview tab with relabeled sections and structured facts", async () => {
    await openBrief();

    // The identity line renders (H1, "You are" stripped).
    expect(screen.getByText(/your character:/i)).toBeInTheDocument();
    // CEO-legible relabels, not the raw sheet headings.
    expect(screen.getByText("How they speak")).toBeInTheDocument();
    expect(screen.queryByText(/PROUD MAKER/)).toBeNull(); // scorer parenthetical dropped
    // Dialog-only structured-fact labels (the cast card uses different wording).
    expect(screen.getByText(/their style/i)).toBeInTheDocument();
    expect(screen.getByText(/what they test/i)).toBeInTheDocument();
  });

  it("keeps scorer sections behind the expander, not shown by default", async () => {
    await openBrief();
    expect(screen.queryByText("What to hold back")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show playing details/i }));
    expect(screen.getByText("What to hold back")).toBeInTheDocument();
  });

  it("Full brief tab renders the raw markdown verbatim", async () => {
    await openBrief();
    fireEvent.click(screen.getByRole("button", { name: /full brief/i }));
    // The raw sheet still carries its markdown markers (## / **) untouched.
    expect(screen.getByText(/## Hidden knowledge/)).toBeInTheDocument();
  });
});
