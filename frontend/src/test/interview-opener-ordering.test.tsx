import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { RespondentSession } from "@/lib/respondent";

// ADD-3.1 (P0 regression pin): the interviewer must OPEN first on EVERY text-from-start
// entry. If the first server call carries the respondent's answer instead of a null
// opener request, the agent stores the user's words as turn 0 and returns its greeting as
// turn 1 — which reads as "the interviewer never replied to me" (audit-walk trace fafb1a5:
// done frame reply = opener at turn_index=1). Both text doors are pinned here:
//   1. start()       — a text-modality session entered from consent.
//   2. switchToText() — a voice-modality session that picks "Start by text instead" before
//                       any turn (the door VoiceCall's pre-call screen opens).
// The invariant both must hold: the FIRST streamTurn call passes message === null.

// VoiceCall is mocked to a thin stand-in that just exposes its "Start by text instead"
// affordance, so the switch-to-text door is exercised without the real voice widget.
vi.mock("@/components/interview/VoiceCall", () => ({
  VoiceCall: ({ onUseText }: { onUseText: () => void }) => (
    <button onClick={onUseText}>Start by text instead</button>
  ),
}));
vi.mock("@/components/interview/PromisedArtifacts", () => ({ PromisedArtifacts: () => null }));
vi.mock("@/lib/liveCaptures", async (o) => {
  const a = await o<typeof import("@/lib/liveCaptures")>();
  return { ...a, useLiveCaptures: () => ({ items: [], extracting: false }) };
});
vi.mock("@/lib/respondent", async (o) => {
  const a = await o<typeof import("@/lib/respondent")>();
  return { ...a, getSession: vi.fn(), streamTurn: vi.fn(), takeTurn: vi.fn() };
});

// jsdom doesn't implement Element.scrollTo (the chat auto-scroll effect calls it).
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = function () {};

import { InterviewClient } from "@/components/interview/InterviewClient";
import { getSession, streamTurn } from "@/lib/respondent";
const getMock = vi.mocked(getSession);
const streamMock = vi.mocked(streamTurn);

// A fresh session with NO turns yet — lands on consent, so the opener has not fired.
function freshSession(modality: "text" | "voice"): RespondentSession {
  return {
    id: "s", status: "active", modality, language: "en",
    transcript: [],
    context: {},
  };
}

beforeEach(() => {
  getMock.mockReset();
  streamMock.mockReset();
  // The interviewer's opener streams back as one delta then a done frame.
  streamMock.mockImplementation(async (_t, _m, h) => {
    h.onDelta("Hi, thanks for making the time — what do you actually do here?");
    h.onDone({ reply: "Hi, thanks for making the time — what do you actually do here?", turn_index: 0, elapsed_minutes: 0, should_offer_pause: false });
  });
});

describe("InterviewClient — interviewer opens first on every text-from-start path (P0)", () => {
  it("start() fires the opener as turn 0 (text-modality consent → chat)", async () => {
    getMock.mockResolvedValue(freshSession("text"));
    render(<InterviewClient token="t" />);
    // Consent screen: the opener must NOT have fired yet (no turn is stolen pre-consent).
    const startBtn = await screen.findByRole("button", { name: /start|begin|ready/i });
    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(startBtn);
    await waitFor(() => expect(streamMock).toHaveBeenCalled());
    // The FIRST server call is the opener request: message === null (turn 0 = agent).
    expect(streamMock.mock.calls[0][1]).toBeNull();
  });

  it("switchToText() fires the opener as turn 0 (voice-modality → Start by text instead)", async () => {
    getMock.mockResolvedValue(freshSession("voice"));
    render(<InterviewClient token="t" />);
    // Consent → pre-call (our VoiceCall stand-in). Opener still must not have fired.
    const startBtn = await screen.findByRole("button", { name: /start|begin|ready/i });
    fireEvent.click(startBtn);
    const textDoor = await screen.findByRole("button", { name: /start by text instead/i });
    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(textDoor);
    await waitFor(() => expect(streamMock).toHaveBeenCalled());
    expect(streamMock.mock.calls[0][1]).toBeNull();
  });
});
