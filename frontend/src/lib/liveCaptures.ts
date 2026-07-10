// Live-capture client for the "Captured live" panel (SIMPLIFY E). Reads the STRUCTURAL
// items the per-turn extractor saved for a session — teams, systems, workflow mentions,
// decision rules, goals, open questions. These are session-scoped DISPLAY data, never
// claim records, so this client never touches the KB routes.
//
// Two doors onto the same data (backend/app/routers/sessions.py):
//   respondent → GET /api/sessions/by-token/{token}/live-captures  (no confidence badge)
//   admin      → GET /api/sessions/{session_id}/live-captures       (ladder-mapped badge)
//
// The polling hook is adapted from Tunç's usePollingQuery (reference/nexus-web-app-main
// lib/hooks/use-polling.ts — the "page updates itself while work happens" pattern); see
// docs/FOR-TUNC.md. Adapted, not pasted: no react-query dependency, honest pause when the
// document is hidden, and it stops as soon as `enabled` goes false (call ends).

import { useEffect, useRef, useState } from "react";
import { api } from "./api";

export type LiveCaptureKind =
  | "team"
  | "system"
  | "workflow"
  | "decision_rule"
  | "goal"
  | "open_question";

export interface LiveCaptureItem {
  id: string;
  kind: LiveCaptureKind;
  label: string;
  detail: string | null;
  status: "capturing" | "saved";
  created_at: string;
  ladder?: "reported"; // admin view only — a live single-source item is Reported at most (A18)
}

export interface LiveCapturesResult {
  items: LiveCaptureItem[];
  extracting: boolean; // a real in-flight extraction job — drives the "Saving" state, never faked
}

export async function getLiveCapturesByToken(token: string): Promise<LiveCapturesResult> {
  return api<LiveCapturesResult>(
    `/api/sessions/by-token/${encodeURIComponent(token)}/live-captures`,
  );
}

export async function getLiveCapturesForSession(sessionId: string): Promise<LiveCapturesResult> {
  return api<LiveCapturesResult>(`/api/sessions/${encodeURIComponent(sessionId)}/live-captures`);
}

// Poll a live-captures endpoint on an interval while `enabled`. Honest about failure: a
// fetch error keeps the last good data (the panel never blanks on a transient blip) and
// the next tick retries. Pauses while the tab is hidden — no reason to poll a call the
// user isn't watching — and resumes on focus.
export function useLiveCaptures(
  fetcher: () => Promise<LiveCapturesResult>,
  { enabled, intervalMs = 2500 }: { enabled: boolean; intervalMs?: number },
): LiveCapturesResult {
  const [result, setResult] = useState<LiveCapturesResult>({ items: [], extracting: false });
  // Keep the latest fetcher without retriggering the effect each render (the caller passes
  // a fresh closure every render; we only want the interval to depend on enabled/interval).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function tick() {
      if (document.hidden) return;
      try {
        const next = await fetcherRef.current();
        if (alive) setResult(next);
      } catch {
        /* keep the last good data; the next tick retries */
      }
    }

    void tick(); // immediate first read, then on the interval
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return result;
}
