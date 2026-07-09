// Thin API client. Backend runs at :8000 in dev; screens built against the
// mocked layer (mocks.ts) flip to live endpoints by swapping the import.
import { browserAccessToken } from "./session";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  // Attach the admin's Supabase JWT so the backend gate (P0-1) admits us. Client
  // Components resolve it from the browser session by default; Server Components pass it
  // in explicitly (they read the cookie via lib/server-token.ts). Signed-out callers get
  // null and send no bearer — correct for the public by-token routes.
  const bearer = token !== undefined ? token : await browserAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    // Next 14 defaults server-side GETs to force-cache, so admin edits (and a just-
    // compiled snapshot) render stale on reload/navigation. This data is always
    // live per request — never cache it (#13). A caller can still override via init.
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Carry the server's own reason when it gives one (FastAPI `detail`) — a caller
    // showing e.message then surfaces the REAL error, not just a status code
    // (July 8, Emre doc-2 P1: Generate-plan failures were fully silent).
    let detail = "";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body — the status line below is all we honestly have */
    }
    throw new Error(detail ? `${detail} (API ${res.status})` : `API ${res.status}: ${path}`);
  }
  return res.json();
}
