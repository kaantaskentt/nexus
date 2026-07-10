import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// PLAN §8 Amendment 1 (task #13): AppShell must give /w/* pages a real mobile layout.
// jsdom can't measure the CSS breakpoint, so these tests pin the STRUCTURE + STATE that
// makes the layout responsive: a hamburger trigger exists, and it toggles a nav drawer
// (role="dialog") that closes on Escape, nav-click, and scrim-tap. The desktop aside is
// always in the DOM (only hidden via CSS), so drawer assertions scope to the dialog.

vi.mock("next/navigation", () => ({ usePathname: () => "/w/acme/interviews" }));
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

import { AppShell } from "@/components/AppShell";
import type { Workspace } from "@/lib/types";

const workspace: Workspace = {
  id: "ws-1",
  name: "Acme Jewelry",
  slug: "acme",
  industry: "retail",
  is_demo: false,
};

function renderShell() {
  return render(
    <AppShell workspace={workspace} workspaces={[workspace]} user={{ name: "Emre K", email: "emre@acme.co" }}>
      <div>page content</div>
    </AppShell>,
  );
}

describe("AppShell responsive drawer", () => {
  it("renders a hamburger trigger and no drawer at rest", () => {
    renderShell();
    expect(screen.getByRole("button", { name: /open navigation/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
  });

  it("opens the nav drawer when the hamburger is clicked", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /open navigation/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const drawer = screen.getByRole("dialog", { name: /navigation/i });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // The same nav + footer items are reachable inside the drawer.
    expect(within(drawer).getByRole("link", { name: /interviews/i })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /trust center/i })).toBeInTheDocument();
  });

  it("closes the drawer on Escape", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getByRole("dialog", { name: /navigation/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
  });

  it("closes the drawer when a nav item is clicked", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const drawer = screen.getByRole("dialog", { name: /navigation/i });

    fireEvent.click(within(drawer).getByRole("link", { name: /workflows/i }));
    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
  });

  it("closes the drawer when the scrim is tapped", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    expect(screen.getByRole("dialog", { name: /navigation/i })).toBeInTheDocument();

    // The scrim is the aria-hidden backdrop that sits behind the dialog panel.
    const scrim = document.querySelector('[aria-hidden="true"].bg-scrim');
    expect(scrim).not.toBeNull();
    fireEvent.click(scrim as Element);
    expect(screen.queryByRole("dialog", { name: /navigation/i })).toBeNull();
  });
});
