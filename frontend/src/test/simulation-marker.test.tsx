import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InterviewClient } from "@/components/interview/InterviewClient";
import type { RespondentSession } from "@/lib/respondent";

// SIMPLIFY I (#12 prod finding): the persistent "practice run" marker must show on EVERY
// screen of a simulation — including the consent / pre-call screens, not only once the room
// is live. An admin must never mistake a simulation for a real interview at any step. The
// marker lives at the Shell level, so this pins it on the consent screen (where it was found
// missing) and asserts a non-simulation session shows nothing.

vi.mock("@/components/interview/VoiceCall", () => ({ VoiceCall: () => null }));
vi.mock("@/components/interview/PromisedArtifacts", () => ({ PromisedArtifacts: () => null }));

vi.mock("@/lib/respondent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/respondent")>();
  return { ...actual, getSession: vi.fn() };
});

import { getSession } from "@/lib/respondent";
const getMock = vi.mocked(getSession);

function session(over: Partial<RespondentSession> = {}): RespondentSession {
  return {
    id: "s-1",
    status: "active",
    modality: "text",
    language: "en",
    transcript: [], // no turns → consent/pre-call screen
    context: { respondent_name: "Kaan", company_name: "Bee Goddess" },
    ...over,
  };
}

beforeEach(() => getMock.mockReset());

describe("SIMULATION marker persistence (SIMPLIFY I)", () => {
  it("shows the persistent practice-run marker on the consent/pre-call screen", async () => {
    getMock.mockResolvedValue(session({ simulation: { label: "Daily Gold Repricing" } }));
    render(<InterviewClient token="t" />);

    // The marker text renders before any conversation starts.
    expect(await screen.findByText(/Simulation · Daily Gold Repricing/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing here reaches your company records/i)).toBeInTheDocument();
  });

  it("shows NO simulation marker for a normal interview session", async () => {
    getMock.mockResolvedValue(session()); // no simulation
    render(<InterviewClient token="t" />);

    // Wait for the consent screen to render, then assert the marker is absent.
    await screen.findByText(/honest conversation/i);
    expect(screen.queryByText(/practice run/i)).toBeNull();
    expect(screen.queryByText(/Simulation ·/i)).toBeNull();
  });
});
