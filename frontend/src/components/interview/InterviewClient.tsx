"use client";

import { displaySpokenText, mergeTurns } from "@/lib/transcript-display";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mic, Pause, SendHorizontal, Check, RefreshCw, WifiOff, Flag } from "lucide-react";
import brand from "@/lib/brand";
import { BrandMark } from "@/components";
import { VoiceCall } from "./VoiceCall";
import { PromisedArtifacts } from "./PromisedArtifacts";
import {
  getSession,
  takeTurn,
  pauseSession,
  completeSession,
  consentCopy,
  type RespondentSession,
} from "@/lib/respondent";

type Phase = "loading" | "load_error" | "consent" | "chat" | "paused" | "done";
type Msg = { role: "interviewer" | "respondent"; text: string };

// The interviewee's live conversation. Per Kaan's P0 directive: every reply comes from
// the real turn engine — there is no scripted fallback. A backend failure shows an
// honest "connection lost, progress saved" state and a retry, never a fake reply.
//
// MODALITY FLEXIBILITY (A21 target 4): voice and text are two doors into the SAME
// session — the server holds one transcript and one turn state, so switching direction
// mid-interview loses nothing. `mode` picks the door; the transcript seeds both sides.
export function InterviewClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<RespondentSession | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [offerPause, setOfferPause] = useState(false);
  const [turnError, setTurnError] = useState(false);
  const [mode, setMode] = useState<"voice" | "text">("text"); // set from session on load
  const lastMessage = useRef<string | null>(null); // for honest retry, not a fallback
  const scroller = useRef<HTMLDivElement>(null);

  function seedFromTranscript(s: RespondentSession) {
    // The server transcript is the one truth — reloads, drops, and modality switches
    // all re-enter the conversation from here, never from a blank thread.
    // mergeTurns: voice transcripts store one row per speech chunk (verbatim); display
    // groups consecutive same-speaker rows into one coherent message (P0-B).
    setMessages(
      mergeTurns(
        s.transcript.map((t) => ({
          role: t.speaker === "agent" ? ("interviewer" as const) : ("respondent" as const),
          text: t.text,
        })),
      ),
    );
  }

  function loadSession() {
    setPhase("loading");
    getSession(token)
      .then((s) => {
        setSession(s);
        setMode(s.modality);
        seedFromTranscript(s);
        // A conversation that already has turns resumes straight into it — a started
        // interview must never present as fresh (and never re-runs consent).
        // A completed link lands on the done page (Kaan F1): that's where the
        // promised-materials uploads live, and the interviewer says "this same link
        // works after too". Re-consenting a finished interview was a dead end.
        setPhase(
          s.status === "completed" ? "done" : s.transcript.length > 0 ? "chat" : "consent",
        );
      })
      .catch(() => setPhase("load_error"));
  }

  useEffect(loadSession, [token]);

  // Voice → text switch: re-pull the authoritative transcript (voice turns land via
  // server webhooks), then open the text door on the same session.
  async function switchToText() {
    try {
      const s = await getSession(token);
      seedFromTranscript(s);
    } catch {
      /* keep whatever we have — the server still holds the record */
    }
    setMode("text");
  }

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, turnError]);

  // One turn against the real engine. On failure: surface the error, keep the message
  // for retry, and NEVER synthesize a reply.
  async function interviewerTurn(message: string | null) {
    lastMessage.current = message;
    setTurnError(false);
    setTyping(true);
    try {
      const result = await takeTurn(token, message);
      setMessages((m) => [...m, { role: "interviewer", text: result.reply }]);
      setOfferPause(result.should_offer_pause);
    } catch {
      setTurnError(true);
    } finally {
      setTyping(false);
    }
  }

  async function start() {
    setPhase("chat");
    // Text opening: the interviewer speaks first — but only on a truly fresh thread; a
    // resumed conversation already has its turns. Voice opens inside the call itself.
    if (mode === "text" && messages.length === 0) {
      await interviewerTurn(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || typing) return;
    setDraft("");
    // Verbatim: the respondent's words are stored exactly as typed (hedges are data).
    setMessages((m) => [...m, { role: "respondent", text }]);
    await interviewerTurn(text);
  }

  async function pause() {
    try {
      await pauseSession(token);
    } catch {
      /* pausing is best-effort; the same link resumes regardless */
    }
    setPhase("paused");
  }

  const [finishing, setFinishing] = useState(false);
  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      // Marks the session completed + enqueues the compile that becomes the report.
      await completeSession(token);
      setPhase("done");
    } catch {
      // Honest: if completion didn't reach the server, don't pretend it did.
      setTurnError(true);
    } finally {
      setFinishing(false);
    }
  }

  const ctx = session?.context;

  if (phase === "loading") {
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <div className="flex h-64 items-center justify-center text-ink-faint">Loading…</div>
      </Shell>
    );
  }

  if (phase === "load_error" || !session) {
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-ink-faint">
            <WifiOff className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl text-ink">We couldn&apos;t open your conversation</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            The link may have expired, or the connection dropped. Nothing you&apos;ve shared is
            lost. Try again in a moment, and you&apos;ll pick up where you left off.
          </p>
          <button
            onClick={loadSession}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "paused") {
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Check className="h-5 w-5" strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl text-ink">Welcome back whenever you&apos;re ready</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Your conversation is saved. Come back to this same link anytime
            {ctx?.respondent_name ? `, ${ctx.respondent_name}` : ""}. You&apos;ll pick up right
            where you left off.
          </p>
          <button
            onClick={() => setPhase("chat")}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Pick up where I left off
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    // SIMPLIFY G: the done page branches by kind. A context-call founder built a snapshot,
    // not an employee record — the role-only "shared by name" promise is wrong for them, and
    // the honest next step is the snapshot their call just produced (deep-linked by slug).
    // The employee interview done page is unchanged.
    const contextDone = Boolean(session?.context_call);
    const slug = session?.workspace_slug;
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-tag-verified">
            <Check className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl text-ink">
            Thank you{ctx?.respondent_name ? `, ${ctx.respondent_name}` : ""}
          </h1>
          {contextDone ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                This becomes the first version of your company snapshot: how the work flows,
                the systems in play, and the open questions worth digging into. You&apos;ll see
                it before anyone on your team is interviewed.
              </p>
              {slug && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <a
                    href={`/w/${slug}/home`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 sm:w-auto sm:px-8"
                  >
                    View company snapshot
                  </a>
                  <a
                    href="/"
                    className="text-sm font-medium text-ink-faint transition-colors hover:text-ink"
                  >
                    Return home
                  </a>
                </div>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              This really helps. We&apos;re putting together a short summary of how the work
              flows for {ctx?.company_name ? `the ${ctx.company_name} team` : "the team"} who
              asked for it. It&apos;s shared by role, not your name, and anything with your name
              on it is only what you okayed while we talked. You can close this page now.
            </p>
          )}
          {/* Kaan F1: whatever they offered to send during the conversation, the upload
              is right here — the accepted offer gets honored on the very next screen. The
              context call asks for one real artifact too (persona Phase 5), so the upload
              affordance stays for both kinds. */}
          <PromisedArtifacts token={token} />
        </div>
      </Shell>
    );
  }

  if (phase === "consent") {
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <ConsentLanding session={session} onStart={start} />
      </Shell>
    );
  }

  // The voice door: same session, same transcript. Switching to text mid-call re-pulls
  // the server record first, so nothing said on the call is missing from the thread.
  if (mode === "voice") {
    return (
      <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
        <VoiceCall
          token={token}
          respondentName={ctx?.respondent_name}
          estMinutes={ctx?.est_minutes}
          priorTurns={messages.map((m) => ({
            role: m.role === "interviewer" ? ("assistant" as const) : ("user" as const),
            text: m.text,
          }))}
          onUseText={switchToText}
          onFinish={finish}
        />
      </Shell>
    );
  }

  // chat
  const topic = ctx?.interview_topic ?? "your work";
  const minutes = ctx?.est_minutes ?? 20;

  return (
    <Shell testBackPath={session?.test_back_path} contextCall={session?.context_call}>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Wraps on narrow phones (mobile pass, July 8): the action row pushed 6px past
            the viewport at 390px and the page wiggled sideways. */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-line pb-3">
          <div>
            <div className="font-display text-lg text-ink">About {topic}</div>
            <div className="text-xs text-ink-faint">
              A relaxed chat · you&apos;re in control · pause anytime
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice and text are the same session — switching direction loses nothing. */}
            <button
              onClick={() => setMode("voice")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
              title="Continue this same conversation by voice"
            >
              <Mic className="h-4 w-4" strokeWidth={1.75} /> Switch to voice
            </button>
            <button
              onClick={pause}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (offerPause
                  ? "bg-accent-soft text-accent-ink hover:bg-accent hover:text-on-accent"
                  : "text-ink-faint hover:bg-surface-raised hover:text-ink")
              }
            >
              <Pause className="h-4 w-4" strokeWidth={1.75} /> Pause
            </button>
            <button
              onClick={finish}
              disabled={finishing || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-40"
              title="Finish the conversation and send it for summary"
            >
              <Flag className="h-4 w-4" strokeWidth={1.75} />
              {finishing ? "Finishing…" : "Finish"}
            </button>
          </div>
        </div>

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={m.role === "respondent" ? "flex justify-end" : "flex gap-2.5"}
            >
              {m.role === "interviewer" && (
                <BrandMark className="mt-1 h-5 w-5 shrink-0 text-accent" />
              )}
              <div
                className={
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                  (m.role === "respondent"
                    ? "rounded-tr-sm bg-accent text-on-accent"
                    : "rounded-tl-sm bg-surface text-ink")
                }
              >
                {/* Display-layer spoken-number parity with the voice room (UI debate
                    safe win 1) — storage stays verbatim, same as LiveTranscript. */}
                {displaySpokenText(m.text)}
              </div>
            </motion.div>
          ))}
          {typing && (
            <div className="flex gap-2.5">
              <BrandMark className="mt-1 h-5 w-5 shrink-0 text-accent" />
              <div className="rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}
          {turnError && !typing && (
            <div className="flex gap-2.5">
              <WifiOff className="mt-1 h-5 w-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
              <div className="rounded-2xl rounded-tl-sm border border-line bg-surface-raised px-4 py-3 text-sm text-ink-soft">
                Connection lost, but your progress is saved. Nothing you typed is gone.
                <button
                  onClick={() => interviewerTurn(lastMessage.current)}
                  className="mt-2 flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} /> Try again
                </button>
              </div>
            </div>
          )}
          {offerPause && !typing && !turnError && (
            <p className="pl-8 text-xs text-ink-faint">
              We&apos;re about {minutes} minutes in. Keep going, or pause and resume later on
              this same link.
            </p>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Type your answer… take your time"
              className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || typing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:bg-accent-hover disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Your words are kept as you say them. Nothing is shared under your name without
            your okay.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// Calm, standalone shell — the respondent is not inside the workspace app.
function Shell({
  children,
  testBackPath,
  contextCall,
}: {
  children: React.ReactNode;
  testBackPath?: string;
  contextCall?: boolean;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5">
          <span className="font-display text-xl tracking-tight text-ink">
            {brand.product_name}
          </span>
          <BrandMark className="h-3.5 w-3.5 text-accent" />
          {/* F7: the context call labels itself BETA everywhere, honestly. */}
          {contextCall && (
            <span className="ml-2 rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint ring-1 ring-inset ring-ink/[0.06]">
              Beta · Context call
            </span>
          )}
          {/* Admin test mode ONLY (P0-C): a way back. Real respondents get no chrome. */}
          {testBackPath && (
            <a
              href={testBackPath}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              ← Test call · Back to Voice Settings
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6">{children}</main>
    </div>
  );
}

function ConsentLanding({
  session,
  onStart,
}: {
  session: RespondentSession;
  onStart: () => void;
}) {
  const c = consentCopy(session);
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl leading-tight text-ink">{c.heading}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">{c.intro}</p>

      <Block title={c.whatItIsTitle}>
        <ul className="space-y-2">
          {c.whatItIs.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title={c.handlingTitle}>
        <ul className="space-y-2">
          {c.handling.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Block>

      <div className="mt-8">
        <button
          onClick={onStart}
          className="w-full rounded-md bg-accent px-6 py-3.5 text-base font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 sm:w-auto sm:px-8"
        >
          {c.startAction}
        </button>
        <p className="mt-3 text-xs text-ink-faint">{c.consentFinePrint}</p>
        <p className="mt-1 text-xs text-ink-faint">
          If now isn&apos;t the time, simply close this page; you can return whenever suits you.
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-hairline mt-6 rounded-card border border-line bg-surface p-5">
      <h2 className="mb-3 font-display text-lg text-ink">{title}</h2>
      {children}
    </section>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-faint"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}
