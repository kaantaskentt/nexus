"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";

// Global error boundary (Emre crash report #3, July 8) — the catch-all for everything
// outside the workspace shell: the picker and the respondent /i flow. A respondent
// mid-interview must never meet a white screen; their transcript is stored server-side
// turn by turn, so "try again" genuinely resumes where they were.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pain-moderate text-tag-guess">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 font-display text-xl text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        Nothing you shared has been lost. Try again — if this keeps happening, close the
        tab and reopen your link.
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
