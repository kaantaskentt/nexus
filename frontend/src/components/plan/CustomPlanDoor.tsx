"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { generate_plan } from "@/lib/live";

// Custom interview door (Kaan product ask, July 7): plan an interview from the admin's
// own free-text focus instead of only the snapshot's suggestions. Same lifecycle as
// every plan — the generator drafts it, NEXUS_CHECK reviews it, a human approves before
// anything sends. The focus shapes objectives; it never reaches the respondent raw.
export function CustomPlanDoor({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await generate_plan(workspaceId, {
        person_name: name.trim(),
        person_role: role.trim() || undefined,
        goal: goal.trim() || undefined,
      });
      setDone(true);
      // The new row lands as DRAFT and flips to NEXUS_CHECK when generation finishes;
      // refresh shows the honest lifecycle state rather than pretending it's ready.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan request failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-surface p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed text-ink-soft">
          Plan requested. It drafts from the records now, then{" "}
          <span className="font-medium text-ink">Nexus checks it before you see it</span> — the
          row below flips out of Draft when that check lands. Nothing sends without your approval.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-sunken/40"
        >
          <Plus className="h-4 w-4" strokeWidth={2} /> Plan a custom interview
        </button>
      ) : (
        <div className="rounded-card border border-line bg-surface p-5">
          <p className="font-display text-lg text-ink">Plan a custom interview</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Aim an interview at something specific. The plan still drafts from the record
            store, still passes the Nexus check, and still waits for your approval before
            anything reaches the person.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who to interview (name)"
              className="rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Their role (optional)"
              className="rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="What should this interview find out? Leave blank to derive the focus from the records."
            className="mt-3 w-full resize-y rounded-md border border-line bg-surface-sunken/40 px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard enabled:hover:-translate-y-px enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
              Draft the plan
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
