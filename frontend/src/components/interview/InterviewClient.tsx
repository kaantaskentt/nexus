"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Pause, SendHorizontal, Check, RefreshCw } from "lucide-react";
import brand from "@/lib/brand";
import { BrandMark } from "@/components";
import {
  getSession,
  takeTurn,
  pauseSession,
  consentCopy,
  type RespondentSession,
  type SessionContext,
} from "@/lib/respondent";

type Phase = "loading" | "consent" | "chat" | "paused";
type Msg = { role: "interviewer" | "respondent"; text: string };

export function InterviewClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<RespondentSession | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [offerPause, setOfferPause] = useState(false);
  const turns = useRef(0); // interviewer replies received so far
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession(token).then((s) => {
      setSession(s);
      setPhase("consent");
    });
  }, [token]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  async function interviewerTurn(message: string | null) {
    setTyping(true);
    const [result] = await Promise.all([
      takeTurn(token, message, turns.current),
      new Promise((r) => setTimeout(r, 650)), // brief "typing" beat
    ]);
    turns.current += 1;
    setTyping(false);
    setMessages((m) => [...m, { role: "interviewer", text: result.reply }]);
    setOfferPause(result.should_offer_pause);
  }

  async function start() {
    setPhase("chat");
    await interviewerTurn(null); // interviewer speaks first
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
    await pauseSession(token);
    setPhase("paused");
  }

  if (phase === "loading" || !session) {
    return (
      <Shell>
        <div className="flex h-64 items-center justify-center text-ink-faint">Loading…</div>
      </Shell>
    );
  }

  if (phase === "paused") {
    const ctx = session.context;
    return (
      <Shell>
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Pause className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-2xl text-ink">Paused — no rush</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Your conversation is saved. Come back to this same link whenever it suits you,
            {ctx.respondent_name ? ` ${ctx.respondent_name}` : ""} — you&apos;ll pick up right
            where you left off.
          </p>
          <button
            onClick={() => setPhase("chat")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Resume now
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "consent") {
    return (
      <Shell>
        <ConsentLanding ctx={session.context} onStart={start} />
      </Shell>
    );
  }

  // chat
  return (
    <Shell>
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <div className="font-display text-lg text-ink">
              About {session.context.interview_topic}
            </div>
            <div className="text-xs text-ink-faint">
              A relaxed chat · you&apos;re in control · pause anytime
            </div>
          </div>
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
                {m.text}
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
          {offerPause && !typing && (
            <p className="pl-8 text-xs text-ink-faint">
              We&apos;re about {session.context.est_minutes} minutes in — keep going, or pause
              and resume later on this same link.
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Send"
            >
              <SendHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            Your words are kept as you say them. You review anything attributed to you before
            it&apos;s shared.
          </p>
        </div>
      </div>
    </Shell>
  );
}

// Calm, standalone shell — the respondent is not inside the workspace app.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5">
          <span className="font-display text-xl tracking-tight text-ink">
            {brand.product_name}
          </span>
          <BrandMark className="h-3.5 w-3.5 text-accent" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6">{children}</main>
    </div>
  );
}

function ConsentLanding({
  ctx,
  onStart,
}: {
  ctx: SessionContext;
  onStart: () => void;
}) {
  const c = consentCopy(ctx);
  return (
    <div className="py-10">
      <h1 className="font-display text-3xl leading-tight text-ink">{c.heading}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">{c.intro}</p>

      <Block title="What this is (and isn't)">
        <ul className="space-y-2">
          {c.whatItIs.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-soft">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="How your words are handled">
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
          className="w-full rounded-lg bg-accent px-6 py-3.5 text-base font-semibold text-on-accent transition-opacity hover:opacity-90 sm:w-auto sm:px-8"
        >
          {c.startAction}
        </button>
        <p className="mt-3 text-xs text-ink-faint">{c.consentFinePrint}</p>
        <p className="mt-1 text-xs text-ink-faint">
          If now isn&apos;t the time, just close this page — you can return whenever suits you.
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-card border border-line bg-surface p-5">
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
