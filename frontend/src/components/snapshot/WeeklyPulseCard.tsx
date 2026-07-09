"use client";

import { useState } from "react";
import { Check, Copy, CalendarClock } from "lucide-react";
import type { WeeklyPulse } from "@/lib/live";
import brand from "@/lib/brand";

// F3 Weekly Pulse: the Monday digest card. Renders ONLY when the per-workspace toggle
// is on (Settings). Nothing is auto-sent: the one action is copying the WhatsApp-ready
// text the backend composed.
export function WeeklyPulseCard({ pulse }: { pulse: WeeklyPulse }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(pulse.whatsapp_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const t = pulse.totals;
  return (
    <section className="mx-auto max-w-6xl px-8 pb-10">
      <div className="card-hairline rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
            <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
            Weekly pulse
          </div>
          <button
            onClick={copy}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition hover:bg-surface-sunken"
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {copied ? "Copied" : "Copy WhatsApp text"}
          </button>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          {[
            { n: t.new_records, label: "new records" },
            { n: t.new_conflicts, label: "new conflicts" },
            { n: t.promises_kept, label: "promises kept" },
            { n: t.promises_pending, label: "promises pending" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-2xl text-ink tabular">{s.n}</div>
              <div className="text-xs text-ink-faint">{s.label}</div>
            </div>
          ))}
        </div>

        {pulse.learned.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="text-xs font-semibold text-ink-faint">
              What {brand.product_name} learned this week
            </div>
            {pulse.learned.map((l, i) => (
              <p key={i} className="text-sm leading-relaxed text-ink-soft">
                {l.text}
                {l.role && <span className="text-ink-faint"> ({l.role})</span>}
              </p>
            ))}
          </div>
        )}

        {pulse.next_step && (
          <p className="mt-4 rounded-lg bg-surface-sunken/60 px-3 py-2 text-sm text-ink">
            <span className="font-medium">Suggested next step:</span> {pulse.next_step}
          </p>
        )}
      </div>
    </section>
  );
}
