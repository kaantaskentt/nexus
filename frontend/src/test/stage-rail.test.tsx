import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Seam-2 fix: StageRail overflowed the page body at 390px on plan (+19) and report (+27).
// jsdom can't measure the CSS breakpoint, so this pins the STRUCTURE that guarantees the
// page body can never scroll horizontally: the rail lives inside an overflow-x-auto +
// min-w-0 wrapper (residual width scrolls the rail, not the page), and a stage with an
// href renders as a real link so earlier stages stay reachable.

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { toString(): string };
    children: React.ReactNode;
  } & Record<string, unknown>) =>
    React.createElement("a", { href: String(href), ...rest }, children),
}));

import { StageRail } from "@/components/interviews/StageRail";

describe("StageRail", () => {
  it("wraps the rail in an overflow-x-auto / min-w-0 scroller so the page body can't scroll", () => {
    render(<StageRail current="report" />);
    const nav = screen.getByRole("navigation", { name: /interview stages/i });
    const wrapper = nav.parentElement!;
    expect(wrapper.className).toContain("overflow-x-auto");
    expect(wrapper.className).toContain("min-w-0");
  });

  it("renders all four stages and links the ones that exist", () => {
    render(
      <StageRail
        current="report"
        hrefs={{ plan: "/w/acme/plans/p1", observe: "/w/acme/interviews/s1" }}
      />,
    );
    for (const label of ["Plan", "Observe", "Report", "Follow-up"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Plan is earlier than the current Report stage and has an href → a real link.
    const planLink = screen.getByText("Plan").closest("a");
    expect(planLink).toHaveAttribute("href", "/w/acme/plans/p1");
  });
});
