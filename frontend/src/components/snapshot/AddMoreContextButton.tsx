"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { start_context_call } from "@/lib/live";

// ANYTIME-CONTEXT (the knowledge-engine loop): Nexus is not a one-shot intake. The CEO can
// come back any time and add more context. This mints ANOTHER context call on the SAME
// workspace (session_kind 'context', additive to the snapshot) and drops them into the same
// polished room. The room is reused untouched; the additive compile folds the new call into
// the existing snapshot (corrections supersede, tags never upgrade). Only rendered where the
// context-call beta is enabled — the mint endpoint 403s otherwise.
export function AddMoreContextButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addContext() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { invite_path } = await start_context_call(workspaceId);
      router.push(invite_path);
      // Leave busy set: we are navigating away, keep the button disabled through the transition.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the context call.");
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        onClick={addContext}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface shadow-elev-1 transition hover:opacity-90 disabled:opacity-60"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        {busy ? "Starting…" : "Add more context"}
      </button>
      {error && <p className="max-w-[16rem] text-right text-xs text-ink-soft">{error}</p>}
    </div>
  );
}
