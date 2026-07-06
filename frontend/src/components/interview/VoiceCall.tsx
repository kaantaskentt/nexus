"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, PhoneOff, PhoneCall, Loader2, MessageSquare, AlertTriangle, Check,
} from "lucide-react";
import { BrandMark } from "@/components";

// Voice interview widget (#26). A real VAPI web call — the assistant is the same
// interviewer brain over voice (custom-LLM webhook carries the session_token so the
// backend joins the turn to the right session). No faked mic test: clicking Start opens
// a genuine call and a genuine mic-permission prompt. Text chat stays the honest fallback.
const ASSISTANTS = {
  asteria: "44d14d38-6de6-4079-aee0-b2bde53eaad3", // F — default
  orion: "0853702b-cb75-4609-8af0-d15653dcbbae", // M
};

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

// Minimal structural view of the VAPI client we use (avoids `any`).
interface VapiLike {
  on(event: string, cb: (payload?: unknown) => void): void;
  start(assistant: string, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  stop(): void;
  setMuted(muted: boolean): void;
}

export function VoiceCall({
  token,
  respondentName,
  onUseText,
  onFinish,
}: {
  token: string;
  respondentName?: string;
  onUseText: () => void;
  onFinish: () => void;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const vapiRef = useRef<VapiLike | null>(null);
  const pubKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;

  // Always tear the call down if the component unmounts mid-conversation.
  useEffect(() => () => { try { vapiRef.current?.stop(); } catch { /* already gone */ } }, []);

  async function startCall() {
    if (!pubKey) {
      setErrorMsg("Voice isn't available right now.");
      setState("error");
      return;
    }
    setState("connecting");
    setErrorMsg(null);
    try {
      const Vapi = (await import("@vapi-ai/web")).default;
      const vapi = new Vapi(pubKey) as unknown as VapiLike;
      vapiRef.current = vapi;
      vapi.on("call-start", () => setState("live"));
      vapi.on("call-end", () => setState("ended"));
      vapi.on("error", (e) => {
        const msg = e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "The call dropped. Your progress is saved.";
        setErrorMsg(msg);
        setState("error");
      });
      // session_token rides the metadata so the backend joins this call to the session.
      await vapi.start(ASSISTANTS.asteria, { metadata: { session_token: token } });
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

  // ── Live / connecting: the call console ──────────────────────────────
  if (state === "connecting" || state === "live") {
    const live = state === "live";
    return (
      <div className="py-12 text-center">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          {live && (
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" aria-hidden />
          )}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-accent-soft text-accent-ink shadow-elev-2 ring-1 ring-inset ring-accent/20">
            {live ? <BrandMark className="h-9 w-9 text-accent" /> : <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.75} />}
          </div>
        </div>
        <h1 className="mt-6 font-display text-2xl text-ink">
          {live ? "You're connected" : "Connecting your call…"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          {live
            ? "Just talk naturally. Take your time, and say things however they come out."
            : "One moment while the line opens. Your browser may ask to use your microphone."}
        </p>

        {live && (
          <div className="mt-8 flex items-center justify-center gap-3">
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
