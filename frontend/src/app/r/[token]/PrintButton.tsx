"use client";

import { Printer } from "lucide-react";

// The only interactive element on the shared report: hand the browser's own
// print-to-PDF to the reader. Hidden in the printed output itself.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-elev-1 transition hover:bg-surface-sunken print:hidden"
    >
      <Printer className="h-4 w-4" strokeWidth={1.75} />
      Print or save as PDF
    </button>
  );
}
