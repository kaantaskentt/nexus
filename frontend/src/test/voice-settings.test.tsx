import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VoiceSettings } from "@/components/VoiceSettings";
import type { VoiceConfig } from "@/lib/live";

// #39: the editor must never claim a change is "live" when it isn't, must filter voices by
// gender, and must send exactly what the admin chose. It also offers a REAL sample preview.

vi.mock("@/lib/live", () => ({ save_voice_config: vi.fn() }));
import { save_voice_config } from "@/lib/live";
const saveMock = vi.mocked(save_voice_config);

const VOICES = [
  { voice_id: "asteria", label: "Asteria", gender: "F" as const, note: "Warm and friendly", provider: "deepgram" as const, preview_url: "https://s/asteria.wav" },
  { voice_id: "luna", label: "Luna", gender: "F" as const, note: "Soft and calm", provider: "deepgram" as const, preview_url: "https://s/luna.wav" },
  { voice_id: "ryan", label: "Ryan", gender: "M" as const, note: "Warm and conversational (default)", provider: "11labs" as const, preview_url: null },
  { voice_id: "orion", label: "Orion", gender: "M" as const, note: "Approachable and warm", provider: "deepgram" as const, preview_url: "https://s/orion.wav" },
];

function config(over: Partial<VoiceConfig> = {}): VoiceConfig {
  return {
    gender: "F", voice_id: "asteria", speed: 1.0, first_message: null,
    assistant_id: "shared-F", is_custom: false, vapi_synced: false, vapi_configured: true,
    voices: VOICES, ...over,
  };
}

// Stub the audio element so preview clicks don't touch a real <audio> in jsdom.
const playSpy = vi.fn().mockResolvedValue(undefined);
const lastSrc = { value: "" };
class FakeAudio {
  onended: (() => void) | null = null;
  pause = vi.fn();
  play = playSpy;
  set src(v: string) { lastSrc.value = v; }
}

beforeEach(() => {
  saveMock.mockReset();
  playSpy.mockClear();
  vi.stubGlobal("Audio", FakeAudio as unknown as typeof Audio);
});

describe("VoiceSettings", () => {
  it("defaults to an honest 'using the default voice' state — never claims a custom live voice", () => {
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);
    expect(screen.getByText(/using the default interview voice/i)).toBeInTheDocument();
    expect(screen.queryByText(/custom interview voice/i)).toBeNull();
  });

  it("filters voices by the gender toggle", () => {
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);
    // Female selected by default: Asteria + Luna present, Orion hidden.
    expect(screen.getByText("Asteria")).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.queryByText("Orion")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Male" }));
    expect(screen.getByText("Orion")).toBeInTheDocument();
    expect(screen.queryByText("Asteria")).toBeNull();
  });

  it("saves exactly the chosen voice + opener", async () => {
    saveMock.mockResolvedValue(config({ voice_id: "luna", is_custom: true, vapi_synced: true }));
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);

    fireEvent.click(screen.getByRole("button", { name: /use luna/i }));
    fireEvent.change(screen.getByPlaceholderText(/thanks so much for making the time/i), {
      target: { value: "  Welcome in.  " },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save voice/i }));
    });

    expect(saveMock).toHaveBeenCalledWith("ws-1", {
      voice_id: "luna", speed: 1.0, first_message: "Welcome in.", // trimmed
    });
    // After a synced save, the banner may say live — but only because the server confirmed it.
    expect(screen.getByText(/live on new calls|saved and live/i)).toBeInTheDocument();
  });

  it("shows the server's honest sync_error instead of a success message", async () => {
    saveMock.mockResolvedValue(
      config({ vapi_synced: false, sync_error: "Saved, but the voice service did not accept the update." }),
    );
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);
    fireEvent.click(screen.getByRole("button", { name: /use luna/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save voice/i }));
    });
    expect(screen.getByText(/did not accept the update/i)).toBeInTheDocument();
  });

  it("plays the real sample clip for a voice when previewed", async () => {
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /play asteria sample/i }));
    });
    // The audio got the voice's public sample url and was played.
    expect(playSpy).toHaveBeenCalled();
    expect(lastSrc.value).toBe("https://s/asteria.wav");
  });

  it("renders no play button for a voice without a sample clip (A20 ElevenLabs roster)", () => {
    render(<VoiceSettings workspaceId="ws-1" initial={config()} />);
    fireEvent.click(screen.getByRole("button", { name: "Male" }));
    // Ryan (11labs, no public clip) is selectable but offers no fake preview…
    expect(screen.getByText("Ryan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play ryan sample/i })).toBeNull();
    // …while Orion (Deepgram) keeps its real one.
    expect(screen.getByRole("button", { name: /play orion sample/i })).toBeInTheDocument();
  });
});
