import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewClient } from "@/components/interview/InterviewClient";
import type { RespondentSession } from "@/lib/respondent";

// SIMPLIFY G (task #4): the respondent done page branches by kind. A context-call founder
// built a snapshot, so they get a "View company snapshot" deep link + "Return home"; the
// employee interview done page is unchanged (role-only promise, no workspace deep link).

vi.mock("@/components/interview/VoiceCall", () => ({ VoiceCall: () => null }));
vi.mock("@/components/interview/PromisedArtifacts", () => ({ PromisedArtifacts: () => null }));

vi.mock("@/lib/respondent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/respondent")>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from "@/lib/respondent";
const getMock = vi.mocked(getSession);

function completed(over: Partial<RespondentSession> = {}): RespondentSession {
  return {
    id: "s-1",
    status: "completed",
    modality: "text",
    language: "en",
    transcript: [],
    context: { respondent_name: "Baris", company_name: "Marmara Hotel" },
    ...over,
  };
}

beforeEach(() => getMock.mockReset());

describe("InterviewClient done page", () => {
  it("context call → snapshot deep link + return home, no role-only promise", async () => {
    getMock.mockResolvedValue(
      completed({ context_call: true, workspace_slug: "marmara-hotel" }),
    );
    render(<InterviewClient token="t" />);

    const snapshot = await screen.findByRole("link", { name: /view company snapshot/i });
    expect(snapshot).toHaveAttribute("href", "/w/marmara-hotel/home");
    expect(screen.getByRole("link", { name: /return home/i })).toHaveAttribute("href", "/");
    expect(
      screen.getByText(/no one on your team is contacted without your approval/i),
    ).toBeInTheDocument();
    // The employee role-only promise must never appear on the founder's page.
    expect(screen.queryByText(/shared by role, not your name/i)).toBeNull();
  });

  it("later context call (snapshot exists) → 'See what's new' label, same destination", async () => {
    getMock.mockResolvedValue(
      completed({ context_call: true, workspace_slug: "marmara-hotel", snapshot_exists: true }),
    );
    render(<InterviewClient token="t" />);

    const cta = await screen.findByRole("link", { name: /see what's new in your snapshot/i });
    expect(cta).toHaveAttribute("href", "/w/marmara-hotel/home");
    expect(screen.queryByRole("link", { name: /view company snapshot/i })).toBeNull();
  });

  it("employee interview → unchanged role-only thank-you, no workspace deep link", async () => {
    getMock.mockResolvedValue(completed());
    render(<InterviewClient token="t" />);

    expect(await screen.findByText(/shared by role, not your name/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view company snapshot/i })).toBeNull();
  });
});
