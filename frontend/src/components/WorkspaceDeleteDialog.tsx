"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, Lock, Trash2, X } from "lucide-react";
import type { WorkspaceDeletePreview } from "@/lib/live";
import { get_workspace_delete_preview } from "@/lib/live";
import { scrimFade, drawerSpring } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";

// SIMPLIFY §4-A: the company-delete dialog (image9). Type-the-name-to-confirm + EXACT
// cascade counts from the preview endpoint + "cannot be undone" + a permanent-lock line.
// The destructive path is NOT live: the Delete button is held behind WORKSPACE_DELETE_ENABLED
// (default off) until Kaan's confirm of the delete semantics is relayed (SIMPLIFY §6-1),
// with honest microcopy instead of a button that pretends to work.
const DELETE_ENABLED = process.env.NEXT_PUBLIC_WORKSPACE_DELETE_ENABLED === "1";

export function WorkspaceDeleteDialog({
  workspaceId,
  name,
  onClose,
}: {
  workspaceId: string;
  name: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<WorkspaceDeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  useEscapeClose(true, onClose);

  useEffect(() => {
    get_workspace_delete_preview(workspaceId)
      .then(setPreview)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "The preview could not be loaded."),
      );
  }, [workspaceId]);

  const items: string[] = [];
  if (preview) {
    const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
    if (preview.sessions > 0)
      items.push(`${preview.sessions} ${plural(preview.sessions, "interview or call", "interviews and calls")} and every recorded turn`);
    if (preview.records > 0)
      items.push(`${preview.records} ${plural(preview.records, "record", "records")} in the Company Context`);
    if (preview.conflicts > 0)
      items.push(`${preview.conflicts} conflict ${plural(preview.conflicts, "finding", "findings")}`);
    if (preview.workflows > 0)
      items.push(`${preview.workflows} workflow ${plural(preview.workflows, "map", "maps")} and any SOPs built from them`);
    if (preview.opportunities > 0)
      items.push(`${preview.opportunities} automation ${plural(preview.opportunities, "opportunity", "opportunities")}`);
    if (preview.entities > 0)
      items.push(`${preview.entities} mapped ${plural(preview.entities, "person, team or system", "people, teams and systems")}`);
    if (preview.scrape_sources > 0)
      items.push(`${preview.scrape_sources} scraped reference ${plural(preview.scrape_sources, "source", "sources")}`);
    if (preview.snapshot_cards > 0) items.push("Its Company Snapshot");
    if (preview.promises > 0)
      items.push(`${preview.promises} shared file ${plural(preview.promises, "promise", "promises")}`);
  }

  const confirmed = preview !== null && typed.trim() === name;

  return (
    <AnimatePresence>
      <motion.div
        variants={scrimFade} initial="hidden" animate="show" exit="hidden"
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-6 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
          transition={drawerSpring}
          className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-elev-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-xl text-ink">Delete company</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  This will permanently remove {name} and all of its associated data.
                  This action <span className="font-semibold text-danger">cannot be undone.</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          {!preview && !error && (
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Counting exactly what this removes...
            </p>
          )}

          {preview && items.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-lg border border-line bg-surface-sunken/50 px-4 py-3">
              {items.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                  <span className="text-ink-faint">&bull;</span> {line}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-ink-soft">
              Type {name} to confirm
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-line-strong"
            />
          </div>

          <button
            disabled={!DELETE_ENABLED || !confirmed}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Delete company
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {DELETE_ENABLED ? "This action is permanent" : "Awaiting final confirmation of delete semantics"}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
