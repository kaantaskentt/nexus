"use client";

// R6 — Section-7 harm-incident inbox (Kaan ruling). Reviewer-scoped; never client-visible.
// Deliberately QUIET: this is a Nexus-team review surface, not a dashboard. Every row is
// already minimized by the backend (no verbatim exists) — category, coarse bucket, when,
// and a session reference are all a reviewer sees here; the fuller sealed-flag lives in the
// ops layer. The reviewer acknowledges or dismisses; that is the whole interaction.

import { useState } from "react";
import { review_incident, type IncidentRow } from "@/lib/live";

const BUCKET_STYLE: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 border-red-500/20",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  yellow: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
};

function fmt(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function IncidentInbox({ initial }: { initial: IncidentRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "reviewed" | "dismissed") {
    setBusy(id);
    setError(null);
    try {
      const res = await review_incident(id, action);
      setRows((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, review_status: action, reviewed_by: res.reviewed_by, reviewed_at: res.reviewed_at }
            : r,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the incident.");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-ink-soft">
        No disclosure incidents. This is the expected state.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.map((r) => {
        const handled = r.review_status !== "unreviewed";
        return (
          <div
            key={r.id}
            className={`flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 ${
              handled ? "opacity-60" : ""
            }`}
          >
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-medium uppercase ${
                BUCKET_STYLE[r.bucket] ?? "border-line text-ink-soft"
              }`}
            >
              {r.bucket}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">
                {r.category} <span className="text-ink-soft">· {r.workspace_name}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-soft">
                {fmt(r.created_at)} · session {r.session_id ? r.session_id.slice(0, 8) : "removed"} ·
                notify {r.notify_status}
                {handled && r.reviewed_by ? ` · ${r.review_status} by ${r.reviewed_by}` : ""}
              </div>
            </div>
            {!handled ? (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => act(r.id, "reviewed")}
                  disabled={busy === r.id}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => act(r.id, "dismissed")}
                  disabled={busy === r.id}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-ink-soft capitalize">{r.review_status}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
