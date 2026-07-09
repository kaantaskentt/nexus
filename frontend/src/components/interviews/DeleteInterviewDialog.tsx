"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import type { DeletePreview } from "@/lib/live";
import { delete_interview, get_delete_preview } from "@/lib/live";
import { scrimFade, drawerSpring } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";

// Kaan P2: the warning dialog IS the feature. It answers his question in plain words
// (yes, the records leave the Knowledge Base too) and lists EXACTLY what the cascade
// removes, from the live preview endpoint — never a generic "are you sure".
export function DeleteInterviewDialog({
  sessionId,
  name,
  onClose,
}: {
  sessionId: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEscapeClose(true, onClose);

  useEffect(() => {
    get_delete_preview(sessionId)
      .then(setPreview)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "The preview could not be loaded."),
      );
  }, [sessionId]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await delete_interview(sessionId);
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The interview could not be deleted.");
      setBusy(false);
    }
  }

  const items: string[] = [];
  if (preview) {
    items.push(`The conversation itself (${preview.turns} recorded turn${preview.turns === 1 ? "" : "s"})`);
    if (preview.records > 0)
      items.push(`${preview.records} record${preview.records === 1 ? "" : "s"} it produced, removed from Company Context`);
    if (preview.conflicts > 0)
      items.push(`${preview.conflicts} conflict finding${preview.conflicts === 1 ? "" : "s"} that cite those records`);
    if (preview.workflows > 0)
      items.push(`Its workflow map${preview.workflows === 1 ? "" : "s"} and any SOP built from it`);
    if (preview.opportunities > 0)
      items.push(`${preview.opportunities} automation opportunit${preview.opportunities === 1 ? "y" : "ies"} resting on that evidence`);
    if (preview.promises > 0)
      items.push(`${preview.promises} shared file promise${preview.promises === 1 ? "" : "s"} from this conversation`);
  }

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
                <h3 className="font-display text-xl text-ink">Delete this interview?</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {name}&apos;s interview and everything learned from it will be removed.
                  Yes, that includes its records: a record whose conversation is gone
                  could never be checked again, so they leave together.
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
              Counting exactly what this removes…
            </p>
          )}

          {preview && (
            <>
              <ul className="mt-4 space-y-1.5 rounded-lg border border-line bg-surface-sunken/50 px-4 py-3">
                {items.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                    <span className="text-ink-faint">•</span> {line}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                {preview.will_rerender_snapshot &&
                  "The Company Snapshot will be rebuilt from the remaining records. "}
                {preview.has_plan && "Its interview plan will be marked revoked. "}
                This cannot be undone.
              </p>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-sunken"
            >
              Keep the interview
            </button>
            <button
              onClick={confirm}
              disabled={!preview || busy}
              className="inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
