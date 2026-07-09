"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ExternalLink, FileText, X } from "lucide-react";
import { mint_report_share } from "@/lib/live";
import { scrimFade, drawerSpring } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";
import brand from "@/lib/brand";

// F2 Monday Morning Report: ONE button. Minting is idempotent server-side, so pressing
// it twice hands back the same link. The dialog offers the two things an admin wants:
// copy the link (to forward) and open the print-ready page (to print or save as PDF).
export function ExportReportButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(open, () => setOpen(false));

  async function exportReport() {
    setOpen(true);
    setCopied(false);
    if (url || busy) return;
    setBusy(true);
    setError(null);
    try {
      const share = await mint_report_share(workspaceId);
      setUrl(`${window.location.origin}${share.path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The report link could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <button
        onClick={exportReport}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-elev-1 transition hover:bg-surface-sunken"
      >
        <FileText className="h-4 w-4" strokeWidth={1.75} />
        Export the Company Report
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={scrimFade} initial="hidden" animate="show" exit="hidden"
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-6 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              transition={drawerSpring}
              className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-elev-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl text-ink">Company Report</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    A print-ready page with the snapshot, workflows, gaps, opportunities
                    and next steps. Anyone with the link can read it; it always shows the
                    current findings.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              {error ? (
                <p className="mt-4 rounded-lg border border-line bg-surface-sunken/60 px-3 py-2 text-sm text-ink-soft">
                  {error}
                </p>
              ) : (
                <>
                  <div className="mt-4 truncate rounded-lg border border-line bg-surface-sunken/60 px-3 py-2 text-xs text-ink-soft">
                    {busy ? "Creating the link…" : url}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={copy}
                      disabled={!url}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition hover:opacity-90 disabled:opacity-50"
                    >
                      {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-sunken"
                      >
                        <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                        Open
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                    Names are never included: findings in the shared report are attributed
                    by role only. A quiet &quot;Powered by {brand.product_name}&quot; line sits in the
                    footer.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
