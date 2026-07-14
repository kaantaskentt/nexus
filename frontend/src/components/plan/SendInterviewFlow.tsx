"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UserPlus, Mic, MessageSquare, Check, Lock, CalendarDays, ChevronDown, X,
  ExternalLink, WifiOff,
} from "lucide-react";
import brand from "@/lib/brand";
import { BrandMark } from "@/components";
import { save_plan_delivery, send_interview, type SendResult } from "@/lib/live";
import { useEscapeClose } from "@/lib/useEscapeClose";
import type { InterviewPlan, Workspace } from "@/lib/types";

type Step = "details" | "preview" | "sent";

// Send Interview flow (A4 — renamed from "Start Interview"): the admin fills
// interviewee details + delivery settings (stage6-assign-interview-form) → previews
// the exact invite (real approved copy from prompts/personas/invite-email.md, with the
// LOCKED purpose block + consent line marked non-editable) → sends → status tracking.
// There is NO decline button anywhere — non-response is the signal.
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
  onSent: (invitePath: string) => void;
}) {
  const [step, setStep] = useState<Step>("details");
  // Prefill from the assign flow's captured delivery intent (K3 single-capture) so the
  // send step is a confirm, not a re-entry. Falls back to sensible defaults.
  const delivery = plan.mission.delivery;
  const [name, setName] = useState(plan.interviewee_name ?? "");
  const [role, setRole] = useState(delivery?.job_title ?? plan.interviewee_role ?? "");
  const [email, setEmail] = useState(delivery?.email ?? "");
  const [modality, setModality] = useState<"voice" | "text">(delivery?.modality ?? "voice");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Persist the admin's choices as they make them (round-2 addendum §3 minor: the modal
  // "re-asserted Voice after Text was selected" — a plan that never went through the
  // assign flow has no saved delivery, so every fresh open fell back to the voice
  // default and a typed email evaporated). Fire-and-forget: a failed save just means
  // the old prefill; the send itself still carries the on-screen values.
  function persistDelivery(patch: { modality?: "voice" | "text"; email?: string; job_title?: string }) {
    void save_plan_delivery(plan.id, patch).catch(() => {});
  }

  function pickModality(m: "voice" | "text") {
    setModality(m);
    persistDelivery({ modality: m });
  }

  function handleClose() {
    setStep("details");
    // Keep what the admin entered — wiping the email on close was exactly the
    // carry-over loss the addendum flagged. Sent state still resets via `result`.
    setResult(null);
    setSendError(false);
    onClose();
  }
  // Escape mirrors the backdrop click — but never mid-send (Emre report #6 family).
  useEscapeClose(open && !sending, handleClose);

  // Real send: mints the respondent session + token and moves the plan to SENT.
  async function handleSend() {
    if (sending) return;
    setSending(true);
    setSendError(false);
    try {
      const r = await send_interview(plan.id, {
        interviewee_name: name,
        email,
        job_title: role,
        language: "en",
        modality,
      });
      setResult(r);
      setStep("sent");
      onSent(r.invite_path);
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  const firstName = name.split(/\s+/)[0] || "there";
  const topic = plan.interview_topic ?? "how the work gets done";
  const minutes = plan.est_time?.total_min ?? 20;
  const admin = workspace.config?.founder ?? brand.sender_name;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
          />
          {/* Centering lives on a flex wrapper, NOT translate classes: framer-motion's
              animated transform (y/scale) overwrites Tailwind's -translate-x/y-1/2 and
              the panel drops below the fold, footer unreachable (July 8 bug-hunt #3 —
              same clobber the New Company modal fixed on July 7). */}
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line bg-canvas shadow-elev-3"
            >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-accent" strokeWidth={1.75} />
                <h2 className="font-display text-xl text-ink">
                  {step === "preview" ? "Preview invite" : step === "sent" ? "Invite sent" : "Assign Employee Interview"}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-ink-faint hover:bg-surface-raised hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {step === "details" && (
                <div className="space-y-5">
                  <p className="text-sm text-ink-soft">
                    Choose who should receive this interview and finalize delivery settings.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name">
                      <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
                    </Field>
                    <Field label="Job title">
                      <input value={role} onChange={(e) => setRole(e.target.value)} onBlur={() => role.trim() && persistDelivery({ job_title: role.trim() })} className="input" />
                    </Field>
                    {/* Email gets the full row — addresses routinely outgrow a third of
                        max-w-2xl, and equal 3-col cells were clipping the local-part. */}
                    <div className="sm:col-span-2">
                      <Field label="Email">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onBlur={() => email.trim() && persistDelivery({ email: email.trim() })}
                          placeholder="name@company.com"
                          className="input"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                      Select interview type
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TypeCard
                        selected={modality === "voice"}
                        onClick={() => pickModality("voice")}
                        icon={Mic}
                        label="Voice"
                      />
                      <TypeCard
                        selected={modality === "text"}
                        onClick={() => pickModality("text")}
                        icon={MessageSquare}
                        label="Text"
                      />
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">
                      Voice is recommended. It tends to surface more examples and detail.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Interview language">
                      <div className="input flex items-center justify-between">
                        <span>English (MVP)</span>
                        <ChevronDown className="h-4 w-4 text-ink-faint" />
                      </div>
                    </Field>
                    <Field label="Complete discovery by">
                      <div className="input flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-ink-faint" />
                        <span>In 5 days · 5:00 PM</span>
                      </div>
                    </Field>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      disabled={!email.trim()}
                      onClick={() => setStep("preview")}
                      className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      Preview message →
                    </button>
                  </div>
                </div>
              )}

              {step === "preview" && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-soft">
                    This is exactly what {firstName} receives. The purpose block and consent
                    line are locked. They are compliance surface, not copy to tune.
                  </p>

                  <div className="rounded-card border border-line bg-surface p-5 text-sm leading-relaxed text-ink">
                    <div className="mb-4 flex items-center gap-1.5">
                      <span className="font-display text-lg tracking-tight text-ink">
                        {brand.product_name}
                      </span>
                      <BrandMark className="h-3.5 w-3.5 text-accent" />
                    </div>

                    <div className="mb-3 border-b border-line pb-3">
                      <div className="text-xs text-ink-faint">Subject</div>
                      <div className="font-medium">
                        Your take on {topic}, {minutes} min, whenever suits you
                      </div>
                    </div>

                    <p>Hi {firstName},</p>
                    <p className="mt-2">
                      {admin} at {workspace.name} has asked {brand.product_name} to understand
                      how things really work day to day, and your view on {topic} is one they
                      specifically wanted to hear.
                    </p>
                    <p className="mt-2 text-ink-soft">
                      It&apos;s a relaxed conversation, about {minutes} minutes, and you can do it
                      whenever it&apos;s convenient. Start now or come back to the same link
                      later. There are no right answers and nothing to prepare.
                    </p>

                    <div className="my-4 rounded-lg border-l-2 border-accent bg-accent-soft p-3">
                      <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-accent-ink">
                        <Lock className="h-3 w-3" strokeWidth={2} /> Locked · Why you&apos;re getting this
                      </div>
                      <p className="text-sm text-ink">
                        {workspace.name} is working with {brand.product_name} to document how work
                        actually happens, so the people who run it are understood accurately. This
                        is not a performance review, and it is not scored. Your words help build a
                        clear picture of the process, not a judgment of you.
                      </p>
                    </div>

                    <span className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
                      Start the conversation →
                    </span>

                    {/* Consent line mirrors prompts/personas/invite-email.md (Emre-primary,
                        July 8): one promise everywhere, and only what the product delivers. */}
                    <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">
                      <Lock className="mr-1 inline h-3 w-3" strokeWidth={2} />
                      By starting, you agree to have this conversation recorded and summarized so
                      your account of the work can be captured accurately. Nothing is quoted with
                      your name on it, and your answers are combined with everyone else&apos;s
                      before anyone sees conclusions. If there&apos;s something you want credited
                      to you, say so, and you&apos;ll see exactly how it appears before it goes
                      anywhere.
                    </p>

                    <p className="mt-3 text-ink-soft">Thanks,<br />{brand.sender_name}</p>
                    <p className="mt-4 text-center text-[11px] text-ink-faint">
                      Sent by {brand.sender_name} on behalf of {workspace.name}
                    </p>
                  </div>

                  {sendError && (
                    <p className="flex items-center justify-center gap-1.5 text-sm text-danger">
                      <WifiOff className="h-4 w-4" strokeWidth={1.75} />
                      Couldn&apos;t send just now. Try again in a moment.
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setStep("details")}
                      className="text-sm text-ink-faint hover:text-ink"
                    >
                      ← Edit details
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
                    >
                      {sending ? "Sending…" : `Send to ${firstName}`}
                    </button>
                  </div>
                </div>
              )}

              {step === "sent" && (
                <div className="space-y-4 py-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-tag-verified">
                    <Check className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-display text-xl text-ink">Invite sent to {firstName}</h3>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                      The plan now tracks progress: Sent, Opened, In progress, Completed. If
                      there&apos;s no response, it simply ages on the board. There is no
                      decline; a decline would be a bias signal.
                    </p>
                  </div>
                  {result && (
                    <a
                      href={result.invite_path}
                      target="_blank"
                      rel="noreferrer"
                      className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-soft"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                      Open {firstName}&apos;s interview link
                    </a>
                  )}
                  <div>
                    <button
                      onClick={handleClose}
                      className="rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-raised"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function TypeCard({
  selected,
  onClick,
  icon: Icon,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof Mic;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors " +
        (selected
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line text-ink-soft hover:bg-surface-raised")
      }
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {label}
      <span
        className={
          "ml-auto flex h-4 w-4 items-center justify-center rounded-full " +
          (selected ? "bg-accent text-on-accent" : "border border-line-strong")
        }
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}
