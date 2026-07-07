"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, PhoneOff, PhoneCall, Loader2, MessageSquare, AlertTriangle, Check,
} from "lucide-react";
import { ParticleOrb, type OrbState } from "./ParticleOrb";
import { MicWaveform } from "./MicWaveform";
import { LiveTranscript, type Turn } from "./LiveTranscript";
import { InterviewProgress } from "./InterviewProgress";
import { getCallVoice } from "@/lib/respondent";

// Voice interview widget (#26, upgraded to the live room in #40). A real VAPI web call —
// the assistant is the same interviewer brain over voice (custom-LLM webhook carries the
// session_token so the backend joins the turn to the right session). No faked mic test:
// clicking Start opens a genuine call and a genuine mic-permission prompt. Text chat stays
// the honest fallback.
//
// The live room is built entirely on REAL call signal:
//   - the orb reacts to VAPI `volume-level` (the assistant's actual output level);
//   - state (listening/thinking/speaking) is derived from `speech-start`/`speech-end`
//     plus `transcript` messages;
//   - the transcript shows real `transcript` turns as they land;
//   - respondent progress is NEUTRAL per A18 — time + process state, never a claims ticker.
// If VAPI doesn't emit a signal we want, we degrade honestly rather than simulate it.
// The two shared default assistants, both on the A20 ElevenLabs recipe: (M) ryan — the
// global default — and (F) sarah, the gendered fallback for F-tagged configs that never
// synced. The hard fallback below uses the M slot (ryan is THE default voice).
const ASSISTANTS = {
  sharedF: "44d14d38-6de6-4079-aee0-b2bde53eaad3", // 11labs sarah
  sharedM: "0853702b-cb75-4609-8af0-d15653dcbbae", // 11labs ryan — the global default (A20)
};

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

// Minimal structural view of the VAPI client we use (avoids `any`).
interface VapiLike {
  on(event: string, cb: (payload?: unknown) => void): void;
  start(assistant: string, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  stop(): void;
  setMuted(muted: boolean): void;
}

// A VAPI `message` of type transcript. Other message types are ignored.
interface TranscriptMessage {
  type: "transcript";
  role: "user" | "assistant";
  transcriptType: "partial" | "final";
  transcript: string;
}
function isTranscript(m: unknown): m is TranscriptMessage {
  return (
    !!m &&
    typeof m === "object" &&
    (m as { type?: unknown }).type === "transcript" &&
    typeof (m as { transcript?: unknown }).transcript === "string"
  );
}

export function VoiceCall({
  token,
  respondentName,
  estMinutes,
  onUseText,
  onFinish,
}: {
  token: string;
  respondentName?: string;
  estMinutes?: number;
  onUseText: () => void;
  onFinish: () => void;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live-room signal (all real, from VAPI events).
  const [volume, setVolume] = useState(0);
  const [orbState, setOrbState] = useState<OrbState>("connecting");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState<Turn | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const vapiRef = useRef<VapiLike | null>(null);
  const pubKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const estSec = Math.max(60, (estMinutes ?? 20) * 60);

  // Always tear the call down if the component unmounts mid-conversation.
  useEffect(() => () => { try { vapiRef.current?.stop(); } catch { /* already gone */ } }, []);

  // Real elapsed-time timer — drives the neutral "time remaining" only. Runs while live.
  useEffect(() => {
    if (state !== "live") return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  async function startCall() {
    if (!pubKey) {
      setErrorMsg("Voice isn't available right now.");
      setState("error");
      return;
    }
    setState("connecting");
    setOrbState("connecting");
    setErrorMsg(null);
    setTurns([]);
    setPartial(null);
    setVolume(0);
    try {
      const Vapi = (await import("@vapi-ai/web")).default;
      const vapi = new Vapi(pubKey) as unknown as VapiLike;
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setState("live");
        setOrbState("listening");
      });
      vapi.on("call-end", () => {
        setState("ended");
        setVolume(0);
      });

      // REAL volume drive for the orb (assistant output level, 0..1).
      vapi.on("volume-level", (v) => {
        if (typeof v === "number") setVolume(v);
      });

      // Assistant speech bounds → speaking / listening.
      vapi.on("speech-start", () => setOrbState("speaking"));
      vapi.on("speech-end", () => { setOrbState("listening"); setVolume(0); });

      // Transcript turns (real). Partial lines update the live row; final lines commit.
      vapi.on("message", (m) => {
        if (!isTranscript(m)) return;
        const role = m.role === "assistant" ? "assistant" : "user";
        const text = m.transcript.trim();
        if (!text) return;
        if (m.transcriptType === "final") {
          setTurns((t) => [...t, { role, text }]);
          setPartial(null);
          // Respondent just finished a thought → interviewer is composing its reply.
          if (role === "user") setOrbState("thinking");
        } else {
          setPartial({ role, text });
        }
      });

      vapi.on("error", (e) => {
        const msg = e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "The call dropped. Your progress is saved.";
        setErrorMsg(msg);
        setState("error");
      });
      // Resolve THIS workspace's assistant (Sprint2-B / #39): the admin's chosen voice is
      // baked into a dedicated VAPI assistant server-side, so we only need its id. Falls
      // back to the shared global default (ryan, A20) if the workspace never customized
      // (or on any lookup hiccup) — a call must never fail to start over a voice preference.
      let assistantId = ASSISTANTS.sharedM;
      try {
        assistantId = (await getCallVoice(token)).assistant_id || assistantId;
      } catch { /* keep the shared default */ }
      // session_token rides the metadata so the backend joins this call to the session.
      await vapi.start(assistantId, { metadata: { session_token: token } });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "We couldn't start the call.");
      setState("error");
    }
  }

  function toggleMute() {
    const v = vapiRef.current;
    if (!v) return;
    const next = !muted;
    try { v.setMuted(next); setMuted(next); } catch { /* ignore */ }
  }

  function endCall() {
    try { vapiRef.current?.stop(); } catch { /* ignore */ }
    setState("ended");
  }

  const hello = respondentName ? `, ${respondentName}` : "";

  // ── Live / connecting: the room ──────────────────────────────────────
  if (state === "connecting" || state === "live") {
    const live = state === "live";
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6">
        {/* The dark orb panel — A19 centerpiece. Particle sphere on real volume + state,
            with the respondent's REAL mic waveform below (MicWaveform taps the live mic;
            it unmounts while muted — honest about what the interviewer can hear). */}
        <div className="flex flex-col items-center">
          <div className="relative w-full max-w-lg overflow-hidden rounded-card bg-[#1c1712] px-6 pb-6 pt-8 shadow-elev-2 ring-1 ring-inset ring-white/[0.06]">
            <div className="relative mx-auto h-52 w-52 sm:h-60 sm:w-60">
              <ParticleOrb volume={live ? volume : 0} state={live ? orbState : "connecting"} />
              {!live && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-accent" strokeWidth={1.75} />
                </div>
              )}
            </div>
            <div className="mx-auto mt-3 h-9 w-64 max-w-full">
              <MicWaveform active={live && !muted} />
              {live && muted && (
                <p className="flex h-full items-center justify-center gap-1.5 text-xs text-white/40">
                  <MicOff className="h-3.5 w-3.5" strokeWidth={1.75} /> Microphone muted
                </p>
              )}
            </div>
          </div>

          <h1 className="mt-5 font-display text-2xl text-ink">
            {live ? "You're connected" : "Connecting your call…"}
          </h1>

          {live ? (
            <div className="mt-4">
              <InterviewProgress state={orbState} elapsedSec={elapsedSec} estSec={estSec} />
            </div>
          ) : (
            <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-ink-soft">
              One moment while the line opens. Your browser may ask to use your microphone.
            </p>
          )}
        </div>

        {/* Live transcript — real turns as the conversation flows. */}
        {live && (
          <div className="mx-auto mt-6 w-full max-w-lg flex-1">
            <div className="card-hairline h-full max-h-[38vh] min-h-[8rem] overflow-hidden rounded-card border border-line bg-surface/60 p-3">
              <LiveTranscript turns={turns} partial={partial} />
            </div>
          </div>
        )}

        {/* Controls */}
        {live && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={toggleMute}
              className={
                "inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors " +
                (muted
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-line-strong text-ink hover:bg-surface-raised")
              }
            >
              {muted ? <MicOff className="h-4 w-4" strokeWidth={1.75} /> : <Mic className="h-4 w-4" strokeWidth={1.75} />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={endCall}
              className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:shadow-elev-2"
            >
              <PhoneOff className="h-4 w-4" strokeWidth={1.75} /> End call
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Ended: hand off to finish or text ────────────────────────────────
  if (state === "ended") {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-tag-verified">
          <Check className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-5 font-display text-2xl text-ink">Call ended</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Your progress is saved. You can finish here, or keep going by text if there is
          more you want to add.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={onFinish}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
          >
            <Check className="h-4 w-4" strokeWidth={2} /> Finish and send
          </button>
          <button
            onClick={onUseText}
            className="inline-flex items-center gap-2 rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} /> Continue by text
          </button>
        </div>
      </div>
    );
  }

  // ── Error: honest, with retry + text fallback ────────────────────────
  if (state === "error") {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 font-display text-2xl text-ink">The call didn&apos;t connect</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          {errorMsg ?? "Something interrupted the line."} Nothing you shared is lost. You can
          try the call again, or switch to text.
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={startCall}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
          >
            <PhoneCall className="h-4 w-4" strokeWidth={1.75} /> Try the call again
          </button>
          <button
            onClick={onUseText}
            className="inline-flex items-center gap-2 rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} /> Use text instead
          </button>
        </div>
      </div>
    );
  }

  // ── Idle: the invitation ─────────────────────────────────────────────
  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-ink shadow-elev-1 ring-1 ring-inset ring-accent/20">
        <PhoneCall className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 font-display text-3xl leading-tight text-ink">
        Ready when you are{hello}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        This is a relaxed voice conversation. Find a quiet moment, and talk the way you
        normally would. Your browser will ask to use your microphone when you start.
      </p>
      <div className="mt-8">
        <button
          onClick={startCall}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-7 py-3.5 text-base font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
        >
          <Mic className="h-5 w-5" strokeWidth={1.75} /> Start voice conversation
        </button>
        <div className="mt-4">
          <button
            onClick={onUseText}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          >
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} /> Prefer to type? Use text chat instead
          </button>
        </div>
      </div>
    </div>
  );
}
