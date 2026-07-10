"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, PhoneOff, PhoneCall, Loader2, MessageSquare, AlertTriangle, Check, RefreshCw,
} from "lucide-react";
import { ParticleOrb, type OrbState } from "./ParticleOrb";
import { MicWaveform } from "./MicWaveform";
import { LiveTranscript, type Turn } from "./LiveTranscript";
import { mergeTurns } from "@/lib/transcript-display";
import { InterviewProgress } from "./InterviewProgress";
import { LiveRoom } from "./LiveRoom";
import { CapturedLivePanel } from "./CapturedLivePanel";
import { getCallVoice } from "@/lib/respondent";
import { getLiveCapturesByToken, useLiveCaptures } from "@/lib/liveCaptures";

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

// A call that ended WITHOUT the respondent asking it to (network, device, provider) is a
// DROP — never a silent slide into text and never a "Call ended" that implies it finished
// on purpose (A21 target 4; the July 6 drop read as a normal completion). SIMPLIFY F: a
// drop no longer throws up a full-screen screen — it keeps the room (transcript preserved)
// and shows an unobtrusive reconnecting banner that auto-recovers, with a manual retry.
type CallState = "idle" | "connecting" | "live" | "ended" | "reconnecting" | "error";

// Minimal structural view of the VAPI client we use (avoids `any`).
interface VapiLike {
  on(event: string, cb: (payload?: unknown) => void): void;
  start(
    assistant: string,
    opts?: { metadata?: Record<string, unknown>; firstMessage?: string },
  ): Promise<unknown>;
  stop(): void;
  setMuted(muted: boolean): void;
}

// Spoken when a conversation RE-enters voice (drop resume or a text→voice switch): the
// full canned opening arc must not replay at someone mid-interview. The brain gets the
// stored transcript server-side (build_voice_system), so "where we left off" is real.
const RESUME_FIRST_MESSAGE =
  "Hi again. We can pick up right where we left off, nothing you shared is lost. " +
  "Whenever you're ready.";

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
  priorTurns = [],
  onUseText,
  onFinish,
}: {
  token: string;
  respondentName?: string;
  estMinutes?: number;
  // The conversation so far (server transcript) — a resumed or switched-in call renders
  // and continues the same thread instead of starting a fresh-looking one.
  priorTurns?: Turn[];
  onUseText: () => void;
  onFinish: () => void;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live-room signal (all real, from VAPI events).
  const [volume, setVolume] = useState(0);
  const [orbState, setOrbState] = useState<OrbState>("connecting");
  const [turns, setTurns] = useState<Turn[]>(() => mergeTurns(priorTurns));
  const [partial, setPartial] = useState<Turn | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // "You're talking but the call can't hear you" (P0-A): local mic activity with zero
  // user transcript events is the July 6/7 drop signature surfaced EARLY and honestly.
  const [micWarning, setMicWarning] = useState(false);
  // SIMPLIFY F: the in-room reconnect signal. "trying" while we auto-recover a drop,
  // "recovered" for a brief confirmation flash once the line is back.
  const [reconnecting, setReconnecting] = useState<null | "trying" | "recovered">(null);
  const autoTried = useRef(false); // one automatic attempt per drop; further tries are manual
  const recoveredTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null); // pending auto-reconnect; cancel on leave

  const vapiRef = useRef<VapiLike | null>(null);
  const heardRef = useRef(false); // any user transcript event arrived
  const mutedRef = useRef(false);
  const watchdog = useRef<{ timer: number | null; stream: MediaStream | null; ctx: AudioContext | null }>(
    { timer: null, stream: null, ctx: null },
  );
  // Set when the respondent pressed End — the only way a call-end is a normal "ended".
  const endRequested = useRef(false);
  // True once any turn exists — a re-entry speaks the resume line, never the full opener.
  const hasHistory = useRef(priorTurns.length > 0);
  const pubKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const estSec = Math.max(60, (estMinutes ?? 20) * 60);

  // Captured-live panel data — real polling, only while the call is live (SIMPLIFY E).
  const captures = useLiveCaptures(() => getLiveCapturesByToken(token), {
    enabled: state === "live",
  });

  // Always tear the call down if the component unmounts mid-conversation.
  useEffect(() => () => {
    try { vapiRef.current?.stop(); } catch { /* already gone */ }
    stopMicWatchdog();
    if (recoveredTimer.current) window.clearTimeout(recoveredTimer.current);
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real elapsed-time timer — drives the neutral "time remaining" only. Runs while live.
  useEffect(() => {
    if (state !== "live") return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  async function startCall(opts?: { reconnect?: boolean }) {
    const reconnect = opts?.reconnect ?? false;
    if (!pubKey) {
      setErrorMsg("Voice isn't available right now.");
      setState("error");
      return;
    }
    // A reconnect keeps the room (state stays "reconnecting", transcript preserved) and
    // shows the banner; a fresh start shows the centered connecting moment.
    if (!reconnect) setState("connecting");
    setOrbState("connecting");
    setErrorMsg(null);
    setPartial(null);
    setVolume(0);
    endRequested.current = false;

    // MIC PREFLIGHT — the July 6 drop's root cause was VAPI killing calls that never
    // received customer audio (mic permission granted late or not at all). Settle the
    // permission BEFORE the call exists, so a mic problem is an honest pre-call message
    // instead of a mid-call drop. The probe stream is released immediately.
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch {
      setErrorMsg(
        "We couldn't reach your microphone. Check the browser's mic permission and try again, or continue by text.",
      );
      // On a reconnect, a mic failure keeps the room + banner (transcript preserved, manual
      // retry / continue-by-text right there); only a first-start mic failure is a full screen.
      setState(reconnect ? "reconnecting" : "error");
      if (reconnect) setReconnecting("trying");
      return;
    }

    try {
      const Vapi = (await import("@vapi-ai/web")).default;
      const vapi = new Vapi(pubKey) as unknown as VapiLike;
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setState("live");
        setOrbState("listening");
        startMicWatchdog();
        // If this start recovered a drop, flash a brief "Reconnected" confirm, then clear.
        setReconnecting((r) => {
          if (r !== "trying") return r;
          autoTried.current = false;
          if (recoveredTimer.current) window.clearTimeout(recoveredTimer.current);
          recoveredTimer.current = window.setTimeout(() => setReconnecting(null), 3500);
          return "recovered";
        });
      });
      vapi.on("call-end", () => {
        setVolume(0);
        stopMicWatchdog();
        // A respondent-requested end is a normal "ended". Anything else is a DROP: keep the
        // room and its transcript, show the reconnecting banner, and auto-recover ONCE
        // (further tries are the manual button) — never a silent completion or text switch.
        if (endRequested.current) {
          setState("ended");
          return;
        }
        setState("reconnecting");
        setOrbState("connecting");
        setReconnecting("trying");
        if (!autoTried.current) {
          autoTried.current = true;
          reconnectTimer.current = window.setTimeout(() => { void startCall({ reconnect: true }); }, 1200);
        }
      });

      // REAL volume drive for the orb (assistant output level, 0..1).
      vapi.on("volume-level", (v) => {
        if (typeof v === "number") setVolume(v);
      });

      // Assistant speech bounds → speaking / listening.
      vapi.on("speech-start", () => setOrbState("speaking"));
      vapi.on("speech-end", () => { setOrbState("listening"); setVolume(0); });

      // Transcript turns (real). Partial lines update the live row; final lines commit.
      // Consecutive same-speaker finals MERGE into one bubble (P0-B): the transcriber
      // finalizes per TTS/speech chunk, and one bubble per fragment read as noise.
      vapi.on("message", (m) => {
        if (!isTranscript(m)) return;
        const role = m.role === "assistant" ? "assistant" : "user";
        const text = m.transcript.trim();
        if (!text) return;
        if (role === "user") {
          // The call CAN hear them — stand the watchdog down for this call.
          heardRef.current = true;
          setMicWarning(false);
        }
        if (m.transcriptType === "final") {
          hasHistory.current = true;
          setTurns((t) => {
            const last = t[t.length - 1];
            if (last && last.role === role) {
              return [...t.slice(0, -1), { role, text: `${last.text} ${text}` }];
            }
            return [...t, { role, text }];
          });
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
          : null;
        setErrorMsg(msg);
        setVolume(0);
        // An error on a LIVE (or reconnecting) call is a drop → in-room reconnect; before
        // connection it's a failure to start → the full error screen. Two different truths.
        setState((s) => {
          if (s === "live" || s === "reconnecting") {
            setOrbState("connecting");
            setReconnecting("trying");
            if (!autoTried.current) {
              autoTried.current = true;
              reconnectTimer.current = window.setTimeout(() => { void startCall({ reconnect: true }); }, 1200);
            }
            return "reconnecting";
          }
          return "error";
        });
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
      // A conversation with history gets the resume line instead of the full opener.
      await vapi.start(assistantId, {
        metadata: { session_token: token },
        ...(hasHistory.current ? { firstMessage: RESUME_FIRST_MESSAGE } : {}),
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "We couldn't start the call.");
      // A failed reconnect stays in-room (banner offers retry / continue-by-text); a failed
      // first start is the full error screen.
      setState(reconnect ? "reconnecting" : "error");
      if (reconnect) setReconnecting("trying");
    }
  }

  function toggleMute() {
    const v = vapiRef.current;
    if (!v) return;
    const next = !muted;
    try { v.setMuted(next); setMuted(next); mutedRef.current = next; } catch { /* ignore */ }
  }

  // ── Mic watchdog (P0-A) ─────────────────────────────────────────────
  // The recurring drop signature (Jul 2 / Jun 25 / Jul 6 / tonight's test call) is VAPI
  // receiving NO customer audio: the person talks, nothing transcribes, the call
  // silence-times-out. Detect it in the first minute: if the LOCAL mic shows sustained
  // speech but no user transcript event ever arrives, say so honestly while the call is
  // still up — instead of letting it die quietly.
  function startMicWatchdog() {
    if (watchdog.current.timer != null) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let talkMs = 0;
      watchdog.current = {
        stream,
        ctx,
        timer: window.setInterval(() => {
          if (heardRef.current) return; // the call hears them — nothing to warn about
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
          if (peak > 18 && !mutedRef.current) talkMs += 300;
          if (talkMs > 2000) setMicWarning(true);
        }, 300),
      };
    }).catch(() => { /* preflight already surfaced permission problems */ });
  }

  function stopMicWatchdog() {
    const w = watchdog.current;
    if (w.timer != null) window.clearInterval(w.timer);
    w.stream?.getTracks().forEach((t) => t.stop());
    void w.ctx?.close().catch(() => undefined);
    watchdog.current = { timer: null, stream: null, ctx: null };
  }

  function cancelPendingReconnect() {
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
    setReconnecting(null);
  }

  function endCall() {
    cancelPendingReconnect();
    endRequested.current = true;
    try { vapiRef.current?.stop(); } catch { /* ignore */ }
    setState("ended");
  }

  // Manual reconnect from the in-room banner (when auto-recovery hasn't caught, or the
  // respondent taps "Try again"). autoTried stays set so we don't also fire an auto-attempt.
  function retryReconnect() {
    autoTried.current = true;
    void startCall({ reconnect: true });
  }

  // Mid-call switch to text: a deliberate stop, then the same session continues as chat.
  function switchToText() {
    cancelPendingReconnect();
    endRequested.current = true;
    try { vapiRef.current?.stop(); } catch { /* ignore */ }
    onUseText();
  }

  const hello = respondentName ? `, ${respondentName}` : "";

  // ── Connecting: the centered "line opening" moment (unchanged) ───────
  if (state === "connecting") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center py-6">
        <div className="relative w-full max-w-lg overflow-hidden rounded-card bg-[#1c1712] px-6 pb-6 pt-8 shadow-elev-2 ring-1 ring-inset ring-white/[0.06]">
          <div className="relative mx-auto h-52 w-52 sm:h-60 sm:w-60">
            <ParticleOrb volume={0} state="connecting" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-accent" strokeWidth={1.75} />
            </div>
          </div>
        </div>
        <h1 className="mt-5 font-display text-2xl text-ink">Connecting your call…</h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-ink-soft">
          One moment while the line opens. Your browser may ask to use your microphone.
        </p>
      </div>
    );
  }

  // ── Live / reconnecting: the room (voice mode) ───────────────────────
  // A drop keeps the room here (transcript preserved) and shows the reconnecting banner —
  // it does NOT throw up a separate screen (SIMPLIFY F).
  if (state === "live" || state === "reconnecting") {
    const live = state === "live";
    // Concept A (Kaan-approved): the orb is a compact presence element in a slim bar —
    // 64px particle avatar in its dark tile, the REAL mic waveform beside it (unmounts
    // while muted — honest about what the interviewer can hear), and the neutral state/
    // time progress on the right (A18). The transcript below owns the screen.
    const presence = (
      <>
        <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface px-4 py-3 shadow-elev-1">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[#1c1712] ring-1 ring-inset ring-white/[0.08]">
            <ParticleOrb volume={volume} state={orbState} />
          </div>
          <div className="h-8 w-36">
            {/* The waveform is honest about what the line can hear: silent while muted OR
                while the connection is down (reconnecting). */}
            <MicWaveform active={!muted && live} />
            {muted && (
              <p className="flex h-full items-center gap-1.5 text-xs text-ink-faint">
                <MicOff className="h-3.5 w-3.5" strokeWidth={1.75} /> Muted
              </p>
            )}
          </div>
          <div className="ml-auto">
            <InterviewProgress state={orbState} elapsedSec={elapsedSec} estSec={estSec} />
          </div>
        </div>
        {micWarning && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              Your microphone is picking you up, but the call isn&apos;t receiving it. Try a
              different mic or browser, or{" "}
              <button onClick={switchToText} className="font-semibold underline underline-offset-2">
                switch to text
              </button>{" "}
              — same conversation, nothing lost.
            </span>
          </div>
        )}
      </>
    );

    const controls = (
      <div className="flex items-center justify-center gap-3">
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
          onClick={switchToText}
          title="Continue this same conversation by text. Nothing is lost"
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
        >
          <MessageSquare className="h-4 w-4" strokeWidth={1.75} /> Switch to text
        </button>
        <button
          onClick={endCall}
          className="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:shadow-elev-2"
        >
          <PhoneOff className="h-4 w-4" strokeWidth={1.75} /> End call
        </button>
      </div>
    );

    return (
      <LiveRoom
        header={presence}
        controls={controls}
        banner={
          reconnecting ? (
            <ReconnectBanner
              phase={reconnecting}
              onRetry={retryReconnect}
              onUseText={switchToText}
            />
          ) : undefined
        }
        capturedPanel={
          <CapturedLivePanel items={captures.items} extracting={captures.extracting} />
        }
        capturedCount={captures.items.length}
      >
        {/* The transcript owns the middle of the room (non-negotiable 5, un-boxed). It stays
            put through a reconnect — nothing shared is lost (SIMPLIFY F). */}
        <div className="h-full p-1">
          <LiveTranscript turns={turns} partial={partial} />
        </div>
      </LiveRoom>
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
            onClick={() => startCall()}
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

  // ── Idle: the two-door start (voice or text, both real, same conversation) ──
  const resuming = turns.length > 0;
  return (
    <div className="py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent-ink shadow-elev-1 ring-1 ring-inset ring-accent/20">
        <PhoneCall className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 font-display text-3xl leading-tight text-ink">
        {resuming ? `Welcome back${hello}` : `Ready when you are${hello}`}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
        {resuming
          ? "Your conversation is saved. Pick it up by voice, or continue by text. It is the same conversation either way."
          : "Talk it through on a relaxed call, or type if you prefer. It is the same conversation either way, and you can switch at any point without losing anything."}
      </p>
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={() => startCall()}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-7 py-3.5 text-base font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
        >
          <Mic className="h-5 w-5" strokeWidth={1.75} />
          {resuming ? "Resume by voice" : "Start voice conversation"}
        </button>
        <button
          onClick={onUseText}
          className="inline-flex items-center gap-2 rounded-md border border-line-strong px-6 py-3.5 text-base font-medium text-ink transition-colors hover:bg-surface-raised"
        >
          <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
          {resuming ? "Continue by text" : "Start by text instead"}
        </button>
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Starting a call will ask for your microphone.
      </p>
    </div>
  );
}

// SIMPLIFY F: the unobtrusive in-room reconnect banner (image1/image20). It sits inside the
// room with the transcript still visible; it auto-recovers a drop and offers a manual retry,
// never a full-screen interruption. "recovered" is a brief confirmation that clears itself.
function ReconnectBanner({
  phase,
  onRetry,
  onUseText,
}: {
  phase: "trying" | "recovered";
  onRetry: () => void;
  onUseText: () => void;
}) {
  if (phase === "recovered") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-4 py-2.5 text-sm text-tag-verified">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>Reconnected. Back together, continuing our conversation.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-line bg-surface-raised px-4 py-2.5 text-sm text-ink-soft">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" strokeWidth={2} />
      <span className="min-w-0 flex-1">
        Reconnecting… hang tight, we&apos;re back in a moment. Nothing you shared is lost.
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-raised"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Try again
        </button>
        <button
          onClick={onUseText}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint transition-colors hover:text-ink"
        >
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} /> Continue by text
        </button>
      </div>
    </div>
  );
}
