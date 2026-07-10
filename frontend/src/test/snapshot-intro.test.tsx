import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SnapshotIntro } from "@/components/snapshot/SnapshotIntro";

// SIMPLIFY B (task #4): the first-snapshot intro shows once, carries only REAL counts, and
// its ONE primary CTA persists the seen flag then reveals the snapshot in place. The
// zero-card DiscoveryUpload branch lives upstream in the server page (this component never
// renders for a zero-card tenant), so it stays untouched.

vi.mock("@/lib/live", () => ({ mark_snapshot_intro_seen: vi.fn() }));
import { mark_snapshot_intro_seen } from "@/lib/live";
const seenMock = vi.mocked(mark_snapshot_intro_seen);

const stats = [
  { key: "records", label: "Records compiled", value: 18 },
  { key: "workflows", label: "Workflows detected", value: 3 },
];
const categories = [
  { key: "overview", title: "Company overview", desc: "how work gets done.", count: 6, unit: "insights" },
];

function renderIntro() {
  return render(
    <SnapshotIntro workspaceId="ws-1" companyName="Marmara Hotel" stats={stats} categories={categories}>
      <div>SNAPSHOT_BODY</div>
    </SnapshotIntro>,
  );
}

beforeEach(() => {
  seenMock.mockReset();
  seenMock.mockResolvedValue({ snapshot_intro_seen: true });
});

describe("SnapshotIntro", () => {
  it("shows the real counts and one primary CTA, snapshot hidden until dismissed", () => {
    renderIntro();
    expect(screen.getByText("Company snapshot ready")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Records compiled")).toBeInTheDocument();
    expect(screen.getByText("Company overview")).toBeInTheDocument();
    // ONE primary CTA — no co-primary "Generate plan" / "Review transcript" (Kaan removed them).
    expect(screen.getByRole("button", { name: /view company snapshot/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate.*plan/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /review transcript/i })).toBeNull();
    expect(screen.queryByText("SNAPSHOT_BODY")).toBeNull();
  });

  it("dismissing persists the flag and reveals the snapshot in place", async () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /view company snapshot/i }));

    expect(seenMock).toHaveBeenCalledWith("ws-1");
    await waitFor(() => expect(screen.getByText("SNAPSHOT_BODY")).toBeInTheDocument());
    expect(screen.queryByText("Company snapshot ready")).toBeNull();
  });

  it("survives a failed persist — the snapshot still reveals (best-effort flag)", async () => {
    seenMock.mockRejectedValue(new Error("network"));
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /view company snapshot/i }));
    await waitFor(() => expect(screen.getByText("SNAPSHOT_BODY")).toBeInTheDocument());
  });
});
