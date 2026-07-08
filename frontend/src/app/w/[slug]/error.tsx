"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";

// Segment error boundary (Emre crash report #3, July 8). A crash in any workspace page
// lands HERE — inside AppShell, so the nav survives and the admin can walk away to any
// other screen — instead of white-screening the whole app. Client-safe copy only: no
// stack traces, no error internals on a surface a client might be watching.
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-8 py-24 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pain-moderate text-tag-guess">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 font-display text-xl text-ink">This screen hit a snag</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        The rest of the workspace is fine — your data is untouched. Try this screen again,
        or use the navigation to keep working.
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={2} /> Try again
      </button>
      {error.digest && (
        <p className="mt-4 text-[11px] text-ink-faint">Reference: {error.digest}</p>
      )}
    </div>
  );
}
