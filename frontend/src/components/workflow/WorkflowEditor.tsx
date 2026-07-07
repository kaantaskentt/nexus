"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  EyeOff,
  FileText,
  Layers,
  History,
  MessageSquarePlus,
  Sparkles,
  X,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import Link from "next/link";
import type {
  EffectiveWorkflow,
  SkillBlueprint,
  WorkflowEditOp,
  WorkflowEditStep,
  WorkflowSop,
  Workspace,
} from "@/lib/types";
import {
  apply_workflow_edit,
  get_blueprint,
  get_sop,
  request_sop,
} from "@/lib/live";
import { rise, staggerParent, drawerSpring, scrimFade } from "@/lib/variants";

// The workflow editor (V2 #21) — the third glass flagship. Claim-derived steps are the
// immutable base; every edit is an append-only overlay the backend records with
// provenance, and we drive an optimistic local store reconciled on each returned
// effective workflow. Manual steps render distinctly (never evidence-backed); remove is a
// reversible soft-hide. SOP + Skill Blueprint export from the same effective view.
export function WorkflowEditor({
  workspace,
  workflow,
}: {
  workspace: Workspace;
  workflow: EffectiveWorkflow;
}) {
  const workflowId = workflow.workflow_id;
  const [steps, setSteps] = useState<WorkflowEditStep[]>(workflow.steps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [panel, setPanel] = useState<null | "sop" | "blueprint">(null);

  // One edit: optimistic-first, then reconcile against the server's folded truth. On
  // failure we restore the pre-edit snapshot and surface it inline (never a silent drop).
  const runEdit = useCallback(
    async (op: WorkflowEditOp, stepId: string | null, payload: Record<string, unknown>, optimistic?: (s: WorkflowEditStep[]) => WorkflowEditStep[]) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const snapshot = steps;
      if (optimistic) setSteps(optimistic(steps));
      try {
        const { effective } = await apply_workflow_edit(workflowId, op, stepId, payload);
        setSteps(effective.steps);
      } catch (e) {
        setSteps(snapshot);
        setError(e instanceof Error ? e.message : "That edit didn't save. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, steps, workflowId],
  );

  const rename = (s: WorkflowEditStep, value: string) => {
    if (value.trim() === (s.action ?? s.title) || !value.trim()) return;
    runEdit("rename", s.step_id, { field: "action", value: value.trim() }, (list) =>
      list.map((x) => (x.step_id === s.step_id ? { ...x, action: value.trim(), title: value.trim(), edited: true } : x)),
    );
  };
  const annotate = (s: WorkflowEditStep, note: string) => {
    if (!note.trim()) return;
    runEdit("annotate", s.step_id, { note: note.trim() }, (list) =>
      list.map((x) =>
        x.step_id === s.step_id
          ? { ...x, edited: true, annotations: [...x.annotations, { note: note.trim(), actor: "admin", at: "now" }] }
          : x,
      ),
    );
  };
  const toggleHide = (s: WorkflowEditStep) =>
    runEdit(s.hidden ? "unhide" : "soft_hide", s.step_id, {}, (list) =>
      list.map((x) => (x.step_id === s.step_id ? { ...x, hidden: !x.hidden, edited: true } : x)),
    );
  const reorder = (s: WorkflowEditStep, dir: -1 | 1) => {
    const target = s.index + dir;
    if (target < 0 || target >= steps.length) return;
    runEdit("reorder", s.step_id, { new_index: target });
  };
  const addManual = (after: number) =>
    runEdit("add_manual", null, { action: "New manual step", after_index: after });

  const visible = useMemo(() => steps.filter((s) => showHidden || !s.hidden), [steps, showHidden]);
  const hiddenCount = steps.filter((s) => s.hidden).length;

  return (
    <>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <Link
          href={`/w/${workspace.slug}/plans`}
          className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to Interviews
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Workflow editor
            </div>
            <h1 className="mt-1 font-display text-[2.5rem] leading-tight text-ink">{workflow.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Evidence-backed steps are the record; your edits are tracked overlays that never
              rewrite it. Manual steps are marked. Removing hides, reversibly.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPanel("blueprint")}
              className="lift inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-line-strong"
            >
              <Layers className="h-4 w-4 text-accent" strokeWidth={1.75} /> Skill Blueprint
            </button>
            <button
              onClick={() => setPanel("sop")}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2"
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} /> Generate SOP
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-line py-3">
          <button
            onClick={() => addManual(steps.length - 1)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add manual step
          </button>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
            >
              {showHidden ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
              {showHidden ? "Hide" : "Show"} {hiddenCount} hidden
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <History className="h-3.5 w-3.5" strokeWidth={1.75} />
            every edit is audited
          </span>
          <div className="ml-auto flex items-center gap-3">
            {busy && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> saving
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
                <Info className="h-3.5 w-3.5" strokeWidth={1.75} /> {error}
              </span>
            )}
          </div>
        </div>

        {/* Canvas. The right-edge fade signals "scroll for more" so a partially-visible
            step reads as a peek, not a hard cut (DESIGN-V2 §4.8). */}
        <div className="relative mt-6">
          <motion.div
            variants={staggerParent}
            initial="hidden"
            animate="show"
            className="flex items-stretch gap-1 overflow-x-auto pb-4"
          >
            {visible.map((step, i) => (
              <div key={step.step_id} className="flex items-stretch gap-1">
                <EditableStepCard
                  step={step}
                  position={i}
                  total={visible.length}
                  onRename={rename}
                  onAnnotate={annotate}
                  onToggleHide={toggleHide}
                  onReorder={reorder}
                  disabled={busy}
                />
                {i < visible.length - 1 && (
                  <div className="flex items-center">
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2} />
                  </div>
                )}
              </div>
            ))}
            {visible.length === 0 && (
              <div className="w-full rounded-card border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-ink-soft">
                No steps yet. Add a manual step to start mapping this workflow.
              </div>
            )}
          </motion.div>
          {visible.length > 0 && (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-canvas to-transparent" />
          )}
        </div>
      </div>

      <ExportPanel workflowId={workflowId} kind={panel} onClose={() => setPanel(null)} />
    </>
  );
}

// One editable step. Claim-derived steps carry an "Evidence" marker; manual steps render
// with a dashed border + MANUAL chip so they're never mistaken for evidence. Hidden steps
// dim and offer a reversible unhide. The title is inline-editable (a rename overlay).
function EditableStepCard({
  step,
  position,
  total,
  onRename,
  onAnnotate,
  onToggleHide,
  onReorder,
  disabled,
}: {
  step: WorkflowEditStep;
  position: number;
  total: number;
  onRename: (s: WorkflowEditStep, value: string) => void;
  onAnnotate: (s: WorkflowEditStep, note: string) => void;
  onToggleHide: (s: WorkflowEditStep) => void;
  onReorder: (s: WorkflowEditStep, dir: -1 | 1) => void;
  disabled: boolean;
}) {
  const manual = step.source === "manual";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.action ?? step.title);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState("");

  const label = step.action ?? step.title;

  return (
    <motion.div
      variants={rise}
      className={
        "flex w-[16rem] shrink-0 flex-col rounded-card border bg-surface p-4 " +
        (step.hidden ? "opacity-55 " : "") +
        (manual ? "card-hairline border-dashed border-line-strong" : "card-hairline border-line")
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={
            "inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] " +
            (manual ? "bg-surface-sunken text-ink-soft" : "bg-accent-soft text-accent-ink")
          }
        >
          {manual ? "Manual" : "Evidence"}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onReorder(step, -1)}
            disabled={disabled || position === 0}
            aria-label="Move left"
            className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            onClick={() => onReorder(step, 1)}
            disabled={disabled || position === total - 1}
            aria-label="Move right"
            className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onRename(step, draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(label);
              setEditing(false);
            }
          }}
          rows={2}
          className="w-full resize-none rounded-md border border-accent bg-surface-sunken px-2 py-1 text-sm font-semibold leading-snug text-ink outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(label);
            setEditing(true);
          }}
          className="text-left text-sm font-semibold leading-snug text-ink hover:text-accent-ink"
          title="Click to rename"
        >
          {label || "Untitled step"}
        </button>
      )}

      {step.tool && <Meta label="Tool" value={step.tool} />}
      {step.input && <Meta label="Input" value={step.input} />}
      {step.output && <Meta label="Output" value={step.output} />}

      {step.annotations.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pt-2">
          {step.annotations.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-ink-soft">
              <MessageSquarePlus className="mt-0.5 h-3 w-3 shrink-0 text-accent" strokeWidth={1.75} />
              {a.note}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        {noting ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              onAnnotate(step, note);
              setNote("");
              setNoting(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setNote("");
                setNoting(false);
              }
            }}
            placeholder="Add a note…"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface-sunken px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-faint"
          />
        ) : (
          <button
            onClick={() => setNoting(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-accent disabled:opacity-50"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} /> Note
          </button>
        )}
        <button
          onClick={() => onToggleHide(step)}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-ink disabled:opacity-50"
          title={step.hidden ? "Restore this step" : "Hide this step (reversible)"}
        >
          {step.hidden ? <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> : <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
          {step.hidden ? "Restore" : "Hide"}
        </button>
      </div>

      {step.edited && !step.hidden && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-accent-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> edited
        </div>
      )}
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-ink-faint">{label}</div>
      <div className="mt-0.5 text-sm leading-snug text-ink">{value === "—" ? <span className="text-ink-faint">Not captured</span> : value}</div>
    </div>
  );
}

// SOP + Skill Blueprint both export from the effective workflow. SOP kicks a job and polls;
// the Blueprint is synchronous. Both render in the glass drawer, matching the app's flagship.
function ExportPanel({
  workflowId,
  kind,
  onClose,
}: {
  workflowId: string;
  kind: null | "sop" | "blueprint";
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {kind && (
        <>
          <motion.div
            variants={scrimFade}
            initial="hidden"
            animate="show"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={drawerSpring}
            className="glass fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col overflow-y-auto border-l p-6 shadow-elev-3"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">
                {kind === "sop" ? "Standard Operating Procedure" : "Skill Blueprint"}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            {kind === "sop" ? <SopExport workflowId={workflowId} /> : <BlueprintExport workflowId={workflowId} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SopExport({ workflowId }: { workflowId: string }) {
  const [sop, setSop] = useState<WorkflowSop | null>(null);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const generate = useCallback(async () => {
    setState("working");
    try {
      await request_sop(workflowId);
      // Poll for the compiled document (the job renders it from the effective workflow).
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const next = await get_sop(workflowId);
        if (next.status === "ready") {
          setSop(next);
          setState("idle");
          return;
        }
      }
      setState("error");
    } catch {
      setState("error");
    }
  }, [workflowId]);

  if (sop?.document) {
    const doc = sop.document;
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-xl text-ink">{doc.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{doc.overview}</p>
        </div>
        <ol className="space-y-3">
          {doc.steps.map((s) => (
            <li key={s.n} className="card-hairline rounded-card border border-line bg-surface p-3.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-sm text-accent-ink">{s.n}</span>
                <span className="font-semibold text-ink">{s.name}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.instructions}</p>
              {s.tool && <p className="mt-1 text-xs text-ink-faint">Tool: {s.tool}</p>}
              {s.note && <p className="mt-1 text-xs text-ink-faint">Note: {s.note}</p>}
            </li>
          ))}
        </ol>
        {doc.follow_ups.length > 0 && (
          <div className="card-hairline rounded-card border border-line bg-surface p-3.5">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">Worth closing next</div>
            <ul className="mt-2 space-y-1.5">
              {doc.follow_ups.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full border border-accent" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm leading-relaxed text-ink-soft">
        Generates the standard operating procedure from the steps as edited, in the
        respondent&apos;s own vocabulary. A document, not an executable skill.
      </p>
      <button
        onClick={generate}
        disabled={state === "working"}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:opacity-60"
      >
        {state === "working" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> Compiling the SOP…
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" strokeWidth={1.75} /> Generate SOP
          </>
        )}
      </button>
      {state === "error" && (
        <p className="text-sm text-danger">The SOP didn&apos;t compile in time. Try again in a moment.</p>
      )}
    </div>
  );
}

function BlueprintExport({ workflowId }: { workflowId: string }) {
  const [bp, setBp] = useState<SkillBlueprint | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  useEffect(() => {
    let alive = true;
    get_blueprint(workflowId)
      .then((b) => {
        if (!alive) return;
        setBp(b);
        setState("idle");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [workflowId]);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-faint">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> Reading the spine…
      </div>
    );
  }
  if (state === "error" || !bp) {
    return <p className="text-sm text-danger">Couldn&apos;t load the blueprint. Try again.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card-hairline flex items-start gap-2.5 rounded-card border border-line bg-surface p-3.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed text-ink-soft">
          What an automation would need to know to run this workflow — the nine universal
          slots per step. <span className="font-medium text-ink">Non-executable</span>: a
          completeness map, never a build spec.
        </p>
      </div>
      {bp.steps.map((s) => (
        <div key={s.index} className="card-hairline rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{s.title}</h3>
            <span className="tabular rounded-chip bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {s.slots_filled}/{s.slots_total}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {Object.entries(s.slots).map(([slot, val]) => (
              <div
                key={slot}
                className={
                  "rounded-md border px-2 py-1.5 text-xs " +
                  (val ? "border-line bg-surface-raised text-ink" : "border-dashed border-line-strong text-ink-faint")
                }
                title={val ?? "not captured yet"}
              >
                <div className="font-medium capitalize">{slot.replace(/_/g, " ")}</div>
                <div className="mt-0.5 truncate">
                  {val ? String(val) : <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 opacity-0" />—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
