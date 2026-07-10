// Live-capture client for the "Captured live" panel (SIMPLIFY E). Reads the STRUCTURAL
// items the per-turn extractor saved for a session — teams, systems, workflow mentions,
// decision rules, goals, open questions. These are session-scoped DISPLAY data, never
// claim records, so this client never touches the KB routes.
//
// Two doors, two AUDIENCES (backend/app/routers/sessions.py) — R1 audience split (Kaan):
//   respondent → GET /api/sessions/by-token/{token}/live-captures  → COUNT ONLY, no items
//                (a respondent must not see the captured content — they'd perform for it)
//   admin      → GET /api/sessions/{session_id}/live-captures       → full items + ladder badge
// The split is enforced at the DATA layer (the by-token payload has no item content); this
// client just reflects it — item content simply never arrives on the respondent door.
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

// The real in-flight extraction signal, shared by both audiences — drives the "Saving"
// heartbeat, never faked.
interface Extracting {
  extracting: boolean;
}

// Admin door: full item content + ladder badge.
export interface LiveCapturesResult extends Extracting {
  items: LiveCaptureItem[];
}

// Respondent door: a live COUNT only — item content never crosses (R1). Enforced server-side.
export interface LiveCaptureCounts extends Extracting {
  count: number;
}

export async function getLiveCapturesByToken(token: string): Promise<LiveCaptureCounts> {
  return api<LiveCaptureCounts>(
    `/api/sessions/by-token/${encodeURIComponent(token)}/live-captures`,
  );
}

export async function getLiveCapturesForSession(sessionId: string): Promise<LiveCapturesResult> {
  return api<LiveCapturesResult>(`/api/sessions/${encodeURIComponent(sessionId)}/live-captures`);
}

// Poll a live-captures endpoint on an interval while `enabled`. Generic over the payload
// shape so the respondent (counts) and admin (items) doors share one honest poller. Honest
// about failure: a fetch error keeps the last good data (the panel never blanks on a
// transient blip) and the next tick retries. Pauses while the tab is hidden — no reason to
// poll a call the user isn't watching — and resumes on focus.
export function useLiveCaptures<T extends Extracting>(
  fetcher: () => Promise<T>,
  { enabled, intervalMs = 2500, initial }: { enabled: boolean; intervalMs?: number; initial: T },
): T {
  const [result, setResult] = useState<T>(initial);
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
