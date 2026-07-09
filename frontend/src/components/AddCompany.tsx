"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Building2, ArrowRight, Loader2 } from "lucide-react";
import { create_workspace } from "@/lib/live";
import brand from "@/lib/brand";
import { scrimFade } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";

// Add company (A17 Stage 0). Opens a modal for name / industry / website / contact,
// creates a REAL tenant (is_demo=false, zero records), then drops the admin onto that
// workspace's guided empty state to upload the CEO call. Industry feeds A14 calibration.
export function AddCompany() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState("");
  const [betaContextCall, setBetaContextCall] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Escape mirrors the backdrop click: closes unless a create is in flight.
  useEscapeClose(open && !submitting, () => setOpen(false));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ws = await create_workspace({
        name: name.trim(),
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
        contact_person: contact.trim() || undefined,
        beta_context_call: betaContextCall || undefined,
      });
      // Land on the new tenant's guided empty state (snapshot renders the upload CTA
      // while there are no records yet). refresh() clears the picker's cached list.
      router.push(`/w/${ws.slug}/home`);
      router.refresh();
    } catch {
      setError("Could not create the company. Check the API is reachable and try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lift inline-flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface/60 px-4 py-3.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Add company
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              variants={scrimFade}
              initial="hidden"
              animate="show"
              exit="hidden"
              onClick={() => !submitting && setOpen(false)}
              className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
            />
            {/* Centering lives on a flex wrapper, NOT translate classes: framer-motion's
                animated transform (y/scale) overwrites Tailwind's -translate-x/y-1/2,
                which anchored the dialog bottom-right (feedback queue, July 7). */}
            <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                // Solid surface, not glass (Emre doc-2 P2: picker text bled through the
                // 72%-alpha panel). Glass stays for edge drawers over a dark scrim;
                // centered FORM dialogs read on solid — same treatment as Send Interview.
                className="pointer-events-auto w-full max-w-md rounded-xl border border-line bg-canvas p-6 shadow-elev-3"
              >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
                    <Building2 className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-ink">New company</h2>
                    <p className="text-xs text-ink-faint">A fresh, private workspace</p>
                  </div>
                </div>
                <button
                  onClick={() => !submitting && setOpen(false)}
                  className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>

              <form onSubmit={onSubmit}>
                <Field label="Company name" required>
                  <input
                    autoFocus
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="Acme Coffee Co."
                  />
                </Field>
                <Field label="Industry" hint="Tunes how the interviewer reads this business">
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="input"
                    placeholder="jewelry, hospitality, PR..."
                  />
                </Field>
                <Field label="Website" hint="Optional. Used later for a recon scan.">
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="input"
                    placeholder="https://company.com"
                  />
                </Field>
                <Field label="Contact person" hint="Who you spoke with">
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="input"
                    placeholder="Founder or main contact"
                  />
                </Field>

                {/* F7 BETA opt-in: the context call replaces the transcript upload with
                    a live conversation. Off by default; labeled honestly. */}
                <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-sunken/40 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={betaContextCall}
                    onChange={(e) => setBetaContextCall(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-current"
                  />
                  <span className="text-sm leading-relaxed text-ink-soft">
                    <span className="font-medium text-ink">
                      Conduct the context call with {brand.product_name}
                    </span>{" "}
                    <span className="rounded-chip bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint ring-1 ring-inset ring-ink/[0.06]">
                      Beta
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      Instead of uploading a transcript, the founder does the first
                      context conversation live, by voice or text.
                    </span>
                  </span>
                </label>

                {error && (
                  <p className="mb-4 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                      Creating workspace
                    </>
                  ) : (
                    <>
                      Create workspace <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </>
                  )}
                </button>
              </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {label}
        </span>
        {required && <span className="text-[10px] text-accent">required</span>}
        {hint && <span className="ml-auto text-[11px] text-ink-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
