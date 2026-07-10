import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ADDENDUM 3.1 (P1): the VoiceCall live transcript must keep rendering turns for the WHOLE
// call. Kaan's live test froze it on the opener (session 5716e93e: full convo in the DB via
// the webhook, screen stuck) — the VAPI client `message` subscription silently dropped. Two
// guards are pinned here: (1) the VAPI-message → turns → LiveRoom wire renders every turn;
// (2) the resilient backstop — if the VAPI subscription drops, polling the server transcript
// (source of truth) un-freezes the room so it can't silently stay stuck.

const handlers: Record<string, (p?: unknown) => void> = {};
class MockVapi {
  on(ev: string, cb: (p?: unknown) => void) { handlers[ev] = cb; }
  async start() { return {}; }
  stop() {}
  setMuted() {}
}
vi.mock("@vapi-ai/web", () => ({ default: MockVapi }));

vi.mock("@/lib/respondent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/respondent")>();
  return {
    ...actual,
    getCallVoice: vi.fn().mockResolvedValue({
      assistant_id: "a", first_message: null, voice_id: "v", gender: "M", speed: 1,
    }),
    getSession: vi.fn(),
  };
});

import { VoiceCall } from "@/components/interview/VoiceCall";
import { getSession } from "@/lib/respondent";
const getSessionMock = vi.mocked(getSession);

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.stubEnv("NEXT_PUBLIC_VAPI_PUBLIC_KEY", "pk_test");
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
  // Backstop poll default: server has nothing extra (so it never overrides live turns).
  getSessionMock.mockResolvedValue({ transcript: [] } as unknown as Awaited<ReturnType<typeof getSession>>);
});

function fire(ev: string, payload?: unknown) {
  act(() => { handlers[ev]?.(payload); });
}
function finalTranscript(role: "user" | "assistant", text: string) {
  return { type: "transcript", role, transcriptType: "final", transcript: text };
}

async function startLive() {
  fireEvent.click(screen.getByRole("button", { name: /start voice conversation/i }));
  await waitFor(() => expect(typeof handlers["call-start"]).toBe("function"));
  fire("call-start");
}

describe("VoiceCall live transcript subscription (ADD-3.1)", () => {
  it("renders every turn as VAPI transcript events arrive — the fast path", async () => {
    render(<VoiceCall token="t" simulation={{ label: "Daily Repricing" }} onUseText={() => {}} onFinish={() => {}} />);
    await startLive();

    fire("message", finalTranscript("assistant", "Hi. I'm Nexus. Thanks for making the time."));
    await waitFor(() => expect(screen.getByText(/I'm Nexus/i)).toBeInTheDocument());
    fire("message", finalTranscript("user", "Hi, I'm a salesperson working with leads."));
    fire("message", finalTranscript("assistant", "Good to meet you. Walk me through a typical day."));

    await waitFor(() => {
      expect(screen.getByText(/salesperson working with leads/i)).toBeInTheDocument();
      expect(screen.getByText(/walk me through a typical day/i)).toBeInTheDocument();
    });
  });

  it("un-freezes from the server transcript if the VAPI subscription drops after the opener", async () => {
    render(<VoiceCall token="t" simulation={{ label: "Daily Repricing" }} onUseText={() => {}} onFinish={() => {}} />);
    await startLive();

    // Only the opener arrives over VAPI — then the client subscription silently dies.
    fire("message", finalTranscript("assistant", "Hi. I'm Nexus."));
    await waitFor(() => expect(screen.getByText(/I'm Nexus/i)).toBeInTheDocument());

    // But the webhook kept storing: the server transcript has the whole conversation.
    getSessionMock.mockResolvedValue({
      transcript: [
        { speaker: "agent", text: "Hi. I'm Nexus." },
        { speaker: "respondent", text: "I run the daily repricing." },
        { speaker: "agent", text: "Walk me through the exceptions when the feed is down." },
      ],
    } as unknown as Awaited<ReturnType<typeof getSession>>);

    // The 2.5s backstop poll must adopt it and un-freeze the room (no more VAPI events fired).
    await waitFor(
      () => {
        expect(screen.getByText(/run the daily repricing/i)).toBeInTheDocument();
        expect(screen.getByText(/exceptions when the feed is down/i)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
