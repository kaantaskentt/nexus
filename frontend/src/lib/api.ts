// Thin API client. Backend runs at :8000 in dev; screens built against the
// mocked layer (mocks.ts) flip to live endpoints by swapping the import.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // Next 14 defaults server-side GETs to force-cache, so admin edits (and a just-
    // compiled snapshot) render stale on reload/navigation. This data is always
    // live per request — never cache it (#13). A caller can still override via init.
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}
