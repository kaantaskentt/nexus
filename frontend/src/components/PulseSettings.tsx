"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { set_pulse_config } from "@/lib/live";

// F3 Weekly Pulse toggle (Settings). OFF by default; flipping it only makes the Monday
// digest card render on Home. Nothing is ever auto-sent.
export function PulseSettings({
  workspaceId,
  initialEnabled,
}: {
  workspaceId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip() {
    const next = !enabled;
    setBusy(true);
    setError(null);
    try {
      await set_pulse_config(workspaceId, next);
      setEnabled(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The setting could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-8 pb-12">
      <div className="card-hairline flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-ink">
            <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
            Weekly pulse
          </div>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
            A Monday digest of the week&apos;s findings on your Home page: new records, new
            conflicts, promises kept and pending, and one suggested next step, with a
            copyable WhatsApp summary. Nothing is sent automatically.
          </p>
          {error && <p className="mt-2 text-xs text-ink-soft">{error}</p>}
        </div>
        <button
          onClick={flip}
          disabled={busy}
          role="switch"
          aria-checked={enabled}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            enabled ? "bg-ink" : "bg-surface-sunken ring-1 ring-inset ring-line"
          } ${busy ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow-elev-1 transition-all ${
              enabled ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
