import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { RespondentSession } from "@/lib/respondent";

// ADD-3.1: a text turn must NEVER silently show no reply. The SSE `done` frame always
// carries the full assembled reply, so even if no delta frames render a bubble (an empty
// or delta-less stream — the "no reply, no error, stuck on Listening" report), the room
// renders the reply from `done`; only a genuinely empty reply surfaces an honest retry.

vi.mock("@/components/interview/VoiceCall", () => ({ VoiceCall: () => null }));
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

function chatSession(): RespondentSession {
  return {
    id: "s", status: "active", modality: "text", language: "en",
    transcript: [{ speaker: "agent", text: "Hi, what do you do here?" }],
    context: {},
  };
}

beforeEach(() => {
  getMock.mockReset();
  streamMock.mockReset();
  getMock.mockResolvedValue(chatSession());
});

async function typeAndSend(text: string) {
  const box = await screen.findByPlaceholderText(/type your answer/i);
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: "Enter" });
}

describe("InterviewClient text turn — never a silent no-reply (ADD-3.1)", () => {
  it("renders the reply from the done frame when no delta frames arrive", async () => {
    streamMock.mockImplementation(async (_t, _m, h) => {
      h.onDone({ reply: "A reply that arrived only in the done frame.", turn_index: 2, elapsed_minutes: 1, should_offer_pause: false });
    });
    render(<InterviewClient token="t" />);
    await typeAndSend("I run the daily repricing.");
    await waitFor(() =>
      expect(screen.getByText(/only in the done frame/i)).toBeInTheDocument(),
    );
  });

  it("surfaces an honest retry (not silence) when the reply is genuinely empty", async () => {
    streamMock.mockImplementation(async (_t, _m, h) => {
      h.onDone({ reply: "", turn_index: 2, elapsed_minutes: 1, should_offer_pause: false });
    });
    render(<InterviewClient token="t" />);
    await typeAndSend("I run the daily repricing.");
    await waitFor(() =>
      expect(screen.getByText(/connection lost, but your progress is saved/i)).toBeInTheDocument(),
    );
  });
});
