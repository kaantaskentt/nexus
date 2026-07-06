"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import brand from "@/lib/brand";
import type { InterviewPlan, Workspace } from "@/lib/types";

type Step = "details" | "preview" | "sent";

// Send Interview flow (A4): CEO fills interviewee details → message preview → send
// → status tracking. Renamed from "Start Interview" (A4). There is NO decline button
// anywhere in this flow — non-response is the signal, handled on the board.
export function SendInterviewFlow({
  open,
  plan,
  workspace,
  onClose,
  onSent,
}: {
  open: boolean;
  plan: InterviewPlan;
  workspace: Workspace;
  onClose: () => void;
  onSent: () => void;
}) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState(plan.interviewee_name ?? "");
  const [role, setRole] = useState(plan.interviewee_role ?? "");
  const [email, setEmail] = useState("");

  function reset() {
    setStep("details");
    setEmail("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const firstName = name.split(/\s+/)[0] || "there";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-scrim"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card border border-line bg-canvas shadow-card"
          >
            {/* Header with step indicator */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-display text-xl text-ink">Send Interview</h2>
              <button
                onClick={handleClose}
                className="rounded-lg px-2 py-1 text-ink-faint hover:bg-surface-raised hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {step === "details" && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-soft">
                    Confirm who this goes to. Their name and role come pre-filled from
                    the plan; add an email to reach them.
                  </p>
                  <Field label="Name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Job title">
                    <input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="input"
                    />
                  </Field>
                  <div className="flex justify-end pt-2">
                    <button
                      disabled={!email.trim()}
                      onClick={() => setStep("preview")}
                      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Preview message →
                    </button>
                  </div>
                </div>
              )}

              {step === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-soft">
                    This is exactly what {firstName} receives. The purpose block and
                    consent line are locked.
                  </p>
                  <div className="rounded-card border border-line bg-surface p-4 text-sm leading-relaxed text-ink">
                    <div className="mb-3 border-b border-line pb-3">
                      <div className="text-xs text-ink-faint">Subject</div>
                      <div className="font-medium">
                        {firstName}, your perspective on how {workspace.name} really
                        works
                      </div>
                    </div>
                    <p>Hi {firstName},</p>
                    <p className="mt-2">
                      {workspace.name} is working with {brand.sender_name} to understand
                      how the work actually gets done day to day — in the words of the
                      people who do it.
                    </p>
                    <div className="my-3 rounded-lg bg-accent-soft p-3 text-accent-ink">
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        Why you
                      </span>
                      <p className="mt-1 text-sm">
                        You own {role.toLowerCase() || "this part of the work"}, so your
                        view of how it runs is exactly what we&apos;re missing.
                      </p>
                    </div>
                    <p className="text-xs text-ink-soft">
                      It&apos;s a short conversation you can pause and resume anytime.
                      What you share is used to map how the company works — you choose
                      what&apos;s attributed to you, and you can redact anything before
                      it&apos;s recorded.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setStep("details")}
                      className="text-sm text-ink-faint hover:text-ink"
                    >
                      ← Edit details
                    </button>
                    <button
                      onClick={() => {
                        onSent();
                        setStep("sent");
                      }}
                      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
                    >
                      Send to {firstName}
                    </button>
                  </div>
                </div>
              )}

              {step === "sent" && (
                <div className="space-y-4 py-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent-ink">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-ink">Invite sent</h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      The plan now tracks {firstName}&apos;s progress — Sent → Opened →
                      In progress → Completed. If there&apos;s no response, it ages on
                      the board with one gentle reminder.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
