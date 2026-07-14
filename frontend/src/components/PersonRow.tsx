"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import type { PersonRef } from "@/lib/types";
import { DiscoveryTag } from "./DiscoveryTag";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";


// A person as a table-style row (stage5 "Suggested People to Interview"). The
// why-line carries RESPONSIBILITY FACTS ONLY (F34) — the caller passes an
// already-filtered line; this component never synthesizes one. Avatars are initials,
// not photos: these people are fiction (A12) and we render no invented faces.
//
// Optional `onSaveName`: Home passes this so the admin can set/correct a name when a
// role-only label later becomes a real person (aliases kept server-side).
export function PersonRow({
  person,
  action,
  className,
  onSaveName,
}: {
  person: PersonRef;
  action?: ReactNode;
  className?: string;
  onSaveName?: (name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = person.name?.trim() || person.role || "Unknown";
  // Role-only face: name missing, or name equals the role (compile often uses the
  // role string as the card name).
  const needsName =
    !person.name?.trim() ||
    (!!person.role && person.name.trim().toLowerCase() === person.role.trim().toLowerCase());

  async function commit() {
    const next = draft.trim();
    if (!next || !onSaveName) return;
    setBusy(true);
    setError(null);
    try {
      await onSaveName(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save name");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
        {initials(person.name || person.role, "?")}
      </div>
      <div className="w-36 shrink-0">
        {editing && onSaveName ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commit();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setError(null);
                    setDraft(person.name ?? "");
                  }
                }}
                placeholder="Full name"
                className="w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink outline-none ring-accent/30 focus:border-accent focus:ring-2"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void commit()}
                aria-label="Save name"
                className="rounded-md p-1 text-accent hover:bg-accent-soft disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraft(person.name ?? "");
                }}
                aria-label="Cancel"
                className="rounded-md p-1 text-ink-faint hover:bg-surface-sunken hover:text-ink"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
            {error && <p className="text-[11px] text-danger">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <div className="font-medium text-ink">{displayName}</div>
              {onSaveName && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(needsName ? "" : (person.name ?? ""));
                    setEditing(true);
                    setError(null);
                  }}
                  aria-label={needsName ? "Set name" : "Edit name"}
                  title={needsName ? "Set name" : "Edit name"}
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    needsName
                      ? "text-accent hover:bg-accent-soft"
                      : "text-ink-faint hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </div>
            {person.name && person.role ? (
              <div className="text-xs text-ink-faint">{person.role}</div>
            ) : needsName && person.role && onSaveName ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setEditing(true);
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Set name
              </button>
            ) : null}
          </>
        )}
      </div>
      <p className="min-w-[12rem] flex-1 text-sm text-ink-soft">
        <span className="font-medium text-accent-ink">Why: </span>
        {person.why_line}
      </p>
      {person.tag && <DiscoveryTag label={person.tag.label} tone={person.tag.tone} />}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
