"use client";

import { useState } from "react";
import { ChevronDown, FilePlus2 } from "lucide-react";
import { DiscoveryUpload } from "./DiscoveryUpload";

// Add-transcript-later (Kaan product ask, July 7): once a snapshot exists the upload
// hero disappears, which left no way to compile a SECOND CEO call days later. This is
// that door — collapsed by default under the snapshot, expanding to the standard
// discovery upload in append mode (same pipeline, same round mechanics, honest copy).
export function AddTranscriptDoor({
  workspaceId,
  defaultSpeaker,
}: {
  workspaceId: string;
  defaultSpeaker?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mx-auto mt-4 max-w-4xl px-8 pb-12">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-card border border-dashed border-line-strong/70 bg-surface px-5 py-4 text-left transition-colors hover:border-line-strong hover:bg-surface-sunken/40"
      >
        <span className="flex items-center gap-3">
          <FilePlus2 className="h-5 w-5 text-ink-faint" strokeWidth={1.5} />
          <span>
            <span className="block text-sm font-semibold text-ink">Add a call transcript</span>
            <span className="block text-xs text-ink-soft">
              A later founder call or follow-up compiles into this same snapshot.
            </span>
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="mt-2 rounded-card border border-line bg-surface">
          <DiscoveryUpload workspaceId={workspaceId} defaultSpeaker={defaultSpeaker} append />
        </div>
      )}
    </section>
  );
}
