"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mic,
  MessageSquare,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Lock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import brand from "@/lib/brand";
import type { InterviewPlan, Workspace } from "@/lib/types";
import {
  generate_plan,
  get_plan,
  refine_plan,
  save_plan_delivery,
  plan_intake,
  type PlanChange,
} from "@/lib/live";
import { cn } from "@/lib/cn";

type Modality = "voice" | "text";
type Phase = "collect" | "drafting" | "intake" | "assign";

// K3 assign flow (image18): the ONE screen that replaces CustomPlanDoor -> plan page ->
// SendInterviewFlow. Collect the person, let Nexus draft the plan from the records, then
// shape delivery + refine the draft in one place. "Review interview" carries the plan into
// the normal gate (the plan detail's approve/check/send is untouched — nothing sends here).
export function AssignInterviewFlow({
  workspace,
  roleSuggestions = [],
}: {
  workspace: Workspace;
  // Known roles from people already in the workspace — offered as suggestions on the
  // required Role field (ADDENDUM 4.1), but the field stays free-text.
  roleSuggestions?: string[];
}) {
  const router = useRouter();
  // Pre-seed from the URL when this flow is entered as a FOLLOW-UP from a report
  // (?name=&role=&focus=): the report's open items become the starting focus, so
  // Follow-up is a real stage that flows through the same draft -> gate path.
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("collect");

  // Step 1 — who + optional focus.
  const [name, setName] = useState(params.get("name") ?? "");
  const [role, setRole] = useState(params.get("role") ?? "");
  const [focus, setFocus] = useState(params.get("focus") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The drafted plan (once generation lands).
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);

  // Delivery intent.
  const [email, setEmail] = useState("");
  const [modality, setModality] = useState<Modality>("voice");
  const language = "en";

  async function draft() {
    if (busy) return;
    // ADDENDUM 4.1: role + focus are REQUIRED now — both sharpen the draft, so the flow
    // asks for them up front instead of silently drafting from thin input.
    if (!name.trim() || !role.trim() || !focus.trim()) {
      setError(
        "Add the person, their role, and what this interview should find out — all three help " +
          brand.product_name + " draft a sharp plan.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await generate_plan(workspace.id, {
        person_name: name.trim(),
        person_role: role.trim() || undefined,
        goal: focus.trim() || undefined,
      });
      setPlanId(r.plan_id);
      setPhase("drafting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the draft.");
      setBusy(false);
    }
  }

  // Poll the plan until its mission has drafted (generation is an async job; the mission
  // fills when the plan reaches the check). Then show the assign screen with the REAL plan.
  const refreshPlan = useCallback(async () => {
    if (!planId) return null;
    const p = await get_plan(workspace.id, planId).catch(() => undefined);
    if (p) setPlan(p);
    return p ?? null;
  }, [planId, workspace.id]);

  useEffect(() => {
    if (phase !== "drafting" || !planId) return;
    let alive = true;
    const tick = async () => {
      const p = await refreshPlan();
      if (!alive) return;
      if (p && (p.mission?.goal?.trim() || (p.mission?.topics?.length ?? 0) > 0)) {
        setName((n) => p.interviewee_name ?? n);
        setRole((rr) => p.interviewee_role ?? rr);
        setModality((m) => (p.mission?.delivery?.modality as Modality) ?? m);
        setEmail((e) => p.mission?.delivery?.email ?? e);
        // ADDENDUM 4.2: before the plan is shown, the intake agent asks 2-3 sharp
        // follow-ups that shape the draft. The plan exists now, so intake can edit it.
        setPhase("intake");
        setBusy(false);
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [phase, planId, refreshPlan]);

  async function reviewInterview() {
    if (!planId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await save_plan_delivery(planId, {
        email: email.trim() || undefined,
        job_title: role.trim() || undefined,
        modality,
        language,
      });
      // Into the normal gate — the plan detail owns check / approve / send.
      router.push(`/w/${workspace.slug}/plans/${planId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
      setBusy(false);
    }
  }

  if (phase === "collect") {
    return (
      <CollectStep
        workspace={workspace}
        name={name}
        role={role}
        focus={focus}
        roleSuggestions={roleSuggestions}
        busy={busy}
        error={error}
        onName={setName}
        onRole={setRole}
        onFocus={setFocus}
        onDraft={draft}
      />
    );
  }

  if (phase === "drafting") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center sm:px-8">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" strokeWidth={2} />
        <h1 className="mt-5 font-display text-2xl text-ink">Drafting the interview</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          {brand.product_name} is drafting a plan for {name || "this person"} from the
          company records, then checking it for leaks and leading questions. This takes a
          few seconds — nothing sends without your approval.
        </p>
      </div>
    );
  }

  if (phase === "intake" && planId) {
    // Refresh the plan when leaving intake so the assign screen shows the shaped draft.
    const finishIntake = async () => {
      await refreshPlan();
      setPhase("assign");
    };
    return (
      <IntakeStep
        workspace={workspace}
        planId={planId}
        name={name}
        onDone={finishIntake}
      />
    );
  }

  // phase === "assign"
  return (
    <AssignStep
      workspace={workspace}
      plan={plan}
      planId={planId!}
      name={name}
      role={role}
      email={email}
      modality={modality}
      busy={busy}
      error={error}
      onName={setName}
      onRole={setRole}
      onEmail={setEmail}
      onModality={setModality}
      onReview={reviewInterview}
      onRefreshPlan={refreshPlan}
    />
  );
}

function CollectStep({
  workspace,
  name,
  role,
  focus,
  roleSuggestions,
  busy,
  error,
  onName,
  onRole,
  onFocus,
  onDraft,
}: {
  workspace: Workspace;
  name: string;
  role: string;
  focus: string;
  roleSuggestions: string[];
  busy: boolean;
  error: string | null;
  onName: (v: string) => void;
  onRole: (v: string) => void;
  onFocus: (v: string) => void;
  onDraft: () => void;
}) {
  const ready = name.trim() && role.trim() && focus.trim();
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:px-8">
      <Link
        href={`/w/${workspace.slug}/interviews`}
        className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to interviews
      </Link>
      <h1 className="mt-3 font-display text-[2.5rem] leading-[1.05] text-ink">New interview</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
        Tell {brand.product_name} who to interview, their role, and what this interview should
        find out. {brand.product_name} drafts the plan from the records, checks it, and waits
        for your approval before anything reaches the person.
      </p>

      <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Name</span>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Who to interview"
              className="mt-1.5 w-full rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Role</span>
            <input
              value={role}
              onChange={(e) => onRole(e.target.value)}
              placeholder="Their role"
              list={roleSuggestions.length > 0 ? "known-roles" : undefined}
              className="mt-1.5 w-full rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            {roleSuggestions.length > 0 && (
              <datalist id="known-roles">
                {roleSuggestions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            )}
          </label>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            What should this interview find out?
          </span>
          <textarea
            value={focus}
            onChange={(e) => onFocus(e.target.value)}
            rows={3}
            placeholder="e.g. how they handle customer reschedules, and where they check availability."
            className="mt-1.5 w-full resize-y rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-faint">
            A sentence is plenty. {brand.product_name} asks you a couple of sharp follow-ups
            next to fill the gaps.
          </span>
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={onDraft}
            disabled={!ready || busy}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Sparkles className="h-4 w-4" strokeWidth={2} />}
            Draft interview plan
          </button>
          <Link href={`/w/${workspace.slug}/interviews`} className="text-sm text-ink-soft hover:text-ink">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

function AssignStep({
  workspace,
  plan,
  planId,
  name,
  role,
  email,
  modality,
  busy,
  error,
  onName,
  onRole,
  onEmail,
  onModality,
  onReview,
  onRefreshPlan,
}: {
  workspace: Workspace;
  plan: InterviewPlan | null;
  planId: string;
  name: string;
  role: string;
  email: string;
  modality: Modality;
  busy: boolean;
  error: string | null;
  onName: (v: string) => void;
  onRole: (v: string) => void;
  onEmail: (v: string) => void;
  onModality: (v: Modality) => void;
  onReview: () => void;
  onRefreshPlan: () => Promise<InterviewPlan | null>;
}) {
  const mission = plan?.mission;
  const topics = mission?.topics ?? [];
  const nameReady = name.trim().length > 0;
  const structureReady = topics.length > 0;

  const checks = [
    { label: "Named interviewee", ok: nameReady },
    { label: "Delivery method selected", ok: true },
    { label: "Language set", ok: true },
    { label: "Interview structure ready", ok: structureReady },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-40 pt-8 sm:px-8">
      <Link
        href={`/w/${workspace.slug}/interviews`}
        className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to interviews
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Add details for Nexus (the live refine door). */}
        <AddDetailsPanel planId={planId} onApplied={onRefreshPlan} />

        {/* Right: the assign form. */}
        <div className="min-w-0">
          <h1 className="font-display text-[2.5rem] leading-[1.05] text-ink">Assign interview</h1>
          <p className="mt-1.5 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
            Choose who receives this interview and finalize the setup before review.
          </p>

          {/* 1 — Employee details */}
          <Section n={1} icon={User} title="Employee details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => onName(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
                />
              </Field>
              <Field label="Job title">
                <input
                  value={role}
                  onChange={(e) => onRole(e.target.value)}
                  placeholder="Their role"
                  className="w-full rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
                />
              </Field>
              <Field label="Email (optional)">
                <input
                  value={email}
                  onChange={(e) => onEmail(e.target.value)}
                  type="email"
                  placeholder="name@company.com"
                  className="w-full rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
                />
              </Field>
            </div>
          </Section>

          {/* 2 — Interview structure (honest fields only: modality + language; the invite
              TTL is fixed at 14 days so there is no editable deadline to fake). */}
          <Section n={2} icon={Sparkles} title="Interview structure">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Interview type
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <ModalityButton
                active={modality === "voice"}
                icon={Mic}
                label="Voice"
                onClick={() => onModality("voice")}
              />
              <ModalityButton
                active={modality === "text"}
                icon={MessageSquare}
                label="Text"
                onClick={() => onModality("text")}
              />
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              Voice tends to surface more examples and detail. Either way it is the same
              interview; the person can switch modes mid-conversation.
            </p>
            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Language
              </span>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink">
                English <span className="text-xs text-ink-faint">(more languages coming)</span>
              </div>
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <Lock className="h-3 w-3" strokeWidth={1.75} />
              The invite link stays valid for 14 days.
            </p>
          </Section>

          {/* 3 — Draft interview plan (the REAL generated plan). */}
          <Section n={3} icon={ClipboardList} title="Draft interview plan">
            {mission ? (
              <div className="space-y-4">
                <KeyLine label="Interview goal">
                  <span className="text-sm text-ink-soft">{mission.goal}</span>
                </KeyLine>
                <KeyLine label="Primary interviewee">
                  <span className="text-sm text-ink">{name || "—"}</span>
                </KeyLine>
                {mission.known_context.length > 0 && (
                  <KeyLine label="Known context">
                    <div className="flex flex-wrap gap-1.5">
                      {mission.known_context.map((k, i) => (
                        <span
                          key={i}
                          className="rounded-chip border border-line bg-surface-sunken px-2.5 py-1 text-xs text-ink-soft"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </KeyLine>
                )}
                {mission.definition_of_done.length > 0 && (
                  <KeyLine label="What a complete answer needs">
                    <ul className="space-y-1">
                      {mission.definition_of_done.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </KeyLine>
                )}
                {topics.length > 0 && (
                  <KeyLine label="Draft topics">
                    <ol className="space-y-1.5">
                      {topics.map((t, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-ink">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
                            {i + 1}
                          </span>
                          <span>{t.label}</span>
                        </li>
                      ))}
                    </ol>
                  </KeyLine>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">The draft is still loading.</p>
            )}
          </Section>

          {/* 4 — Readiness (real checks only). */}
          <Section n={4} icon={CheckCircle2} title="Readiness">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {checks.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm",
                    c.ok ? "text-ink-soft" : "text-ink-faint",
                  )}
                >
                  <CheckCircle2
                    className={cn("h-4 w-4", c.ok ? "text-success" : "text-line-strong")}
                    strokeWidth={2}
                  />
                  {c.label}
                </span>
              ))}
            </div>
          </Section>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </div>
      </div>

      {/* Footer bar → the normal gate. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur-sm lg:left-[236px]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-8">
          <Link
            href={`/w/${workspace.slug}/interviews`}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken/40"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <Lock className="h-3 w-3" strokeWidth={1.75} />
              {brand.product_name} prepares the final review before anything reaches the person.
            </span>
            <button
              onClick={onReview}
              disabled={busy || !nameReady || !structureReady}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
              Review interview
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// The live refine door (image18 "Add details for Nexus"): plain language → the EXISTING
// refine-chat endpoint (bounded, audited edits). Each turn shows the applied-changes
// checklist ("Nexus will apply your input"), then re-pulls the plan so the draft updates.
function AddDetailsPanel({
  planId,
  onApplied,
}: {
  planId: string;
  onApplied: () => Promise<InterviewPlan | null>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<{ target: string; op: string; value: string }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const countRef = useRef(0);

  async function apply() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await refine_plan(planId, t);
      if (r.applied.length > 0) {
        setApplied((prev) => [...r.applied, ...prev].slice(0, 8));
        countRef.current += r.applied.length;
        setText("");
        await onApplied();
      }
      setNote(
        r.applied.length > 0
          ? `Applied ${r.applied.length} change${r.applied.length === 1 ? "" : "s"} to the plan.`
          : r.reply || "No change applied.",
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h2 className="font-display text-lg text-ink">Add details for {brand.product_name}</h2>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">
        If anything is missing, describe it here and {brand.product_name} updates the
        interview structure.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder="e.g. also ask how they handle customer reschedules and where they check availability."
        className="mt-3 w-full resize-y rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
      />
      <div className="mt-1 text-right text-[11px] text-ink-faint">{text.length}/500</div>

      {applied.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {brand.product_name} applied your input
          </div>
          <ul className="mt-2 space-y-2">
            {applied.map((a, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/30 p-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink capitalize">
                    {a.op} · {a.target.replace(/_/g, " ")}
                  </div>
                  <div className="truncate text-xs text-ink-soft">{a.value}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}

      <button
        onClick={apply}
        disabled={busy || !text.trim()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors enabled:hover:border-line-strong enabled:hover:bg-surface-sunken/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
        Update structure
      </button>
    </aside>
  );
}

// Intake phase (ADDENDUM 4.2): a short, records/plan-aware conversation on the DRAFT plan
// before the assign screen. The agent asks 2-3 sharp follow-ups one at a time; each answer
// shapes the plan via the /intake endpoint (same bounded edits as refine), and every answer's
// storage decision is shown honestly as a chip. Nothing the admin says is spoken to the
// interviewee (non-negotiable 2); intake is skippable.
function IntakeStep({
  workspace,
  planId,
  name,
  onDone,
}: {
  workspace: Workspace;
  planId: string;
  name: string;
  onDone: () => void;
}) {
  type Turn = { role: "agent" | "admin"; text: string };
  const [turns, setTurns] = useState<Turn[]>([]);
  const [applied, setApplied] = useState<PlanChange[]>([]);
  const [chips, setChips] = useState<{ label: string; stored: boolean; why: string | null }[]>([]);
  const [draftMsg, setDraftMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const runTurn = useCallback(
    async (message: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const r = await plan_intake(planId, message);
        setTurns((t) => [
          ...t,
          ...(r.reply ? [{ role: "agent" as const, text: r.reply }] : []),
          ...(r.question ? [{ role: "agent" as const, text: r.question }] : []),
        ]);
        if (r.applied.length > 0) setApplied((a) => [...r.applied, ...a].slice(0, 12));
        // Show the storage decision only on answer turns (not the opening question), so the
        // admin always sees whether a fact was stored — never silently.
        if (message !== null) {
          setChips((c) => [
            { label: r.storage.chip, stored: r.storage.stored, why: r.storage.why },
            ...c,
          ].slice(0, 6));
        }
        if (r.done || !r.question) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not go through. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [planId],
  );

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void runTurn(null);
  }, [runTurn]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send() {
    const m = draftMsg.trim();
    if (!m || busy || done) return;
    setTurns((t) => [...t, { role: "admin", text: m }]);
    setDraftMsg("");
    await runTurn(m);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:px-8">
      <Link
        href={`/w/${workspace.slug}/interviews`}
        className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to interviews
      </Link>
      <div className="mt-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h1 className="font-display text-[2rem] leading-tight text-ink">A couple of quick questions</h1>
      </div>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-soft">
        {brand.product_name} asks 2 or 3 sharp follow-ups to make {name || "this"}&apos;s interview
        genuinely useful. Your answers shape the questions {brand.product_name} will ask, and
        nothing you say here is ever spoken to {name || "the interviewee"} as a statement.
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
        <div ref={scroller} className="max-h-[42vh] space-y-3 overflow-y-auto">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "admin" ? "flex justify-end" : "flex gap-2.5"}>
              {t.role === "agent" && (
                <Sparkles className="mt-1 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  t.role === "admin"
                    ? "rounded-tr-sm bg-accent text-on-accent"
                    : "rounded-tl-sm bg-surface-sunken/60 text-ink",
                )}
              >
                {t.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 pl-6 text-xs text-ink-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> thinking
            </div>
          )}
        </div>

        {!done ? (
          <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
            <textarea
              value={draftMsg}
              onChange={(e) => setDraftMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Type your answer…"
              className="max-h-32 min-w-0 flex-1 resize-none rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            <button
              onClick={send}
              disabled={!draftMsg.trim() || busy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent transition-colors enabled:hover:bg-accent-hover disabled:opacity-50"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm text-ink-soft">
            <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2} /> That is enough to
            sharpen the plan.
          </div>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      {applied.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {brand.product_name} shaped the plan
          </div>
          <ul className="mt-2 space-y-2">
            {applied.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-line bg-surface-sunken/30 p-2.5"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2} />
                <div className="min-w-0">
                  <div className="text-xs font-medium capitalize text-ink">
                    {a.op} · {a.target.replace(/_/g, " ")}
                  </div>
                  <div className="truncate text-xs text-ink-soft">{a.value}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            What happens with what you shared
          </div>
          <ul className="mt-2 space-y-1.5">
            {chips.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-chip px-2 py-0.5 font-medium ring-1 ring-inset",
                    c.stored
                      ? "bg-accent-soft text-accent-ink ring-accent/20"
                      : "bg-surface-sunken text-ink-soft ring-ink/[0.06]",
                  )}
                >
                  {c.stored ? <Lock className="h-3 w-3" strokeWidth={1.75} /> : null}
                  {c.label}
                </span>
                {c.why && <span className="min-w-0 text-ink-faint">{c.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onDone}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:opacity-50"
        >
          Continue to setup <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </button>
        {!done && (
          <button onClick={onDone} disabled={busy} className="text-sm text-ink-soft hover:text-ink">
            Skip these
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h2 className="flex items-baseline gap-2 font-semibold text-ink">
          <span className="text-xs font-semibold text-ink-faint">{n}</span>
          {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function KeyLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr] sm:gap-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint sm:pt-0.5">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ModalityButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Mic;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-accent-ink shadow-elev-1"
          : "border-line text-ink-soft hover:border-line-strong hover:bg-surface-sunken/40",
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}
