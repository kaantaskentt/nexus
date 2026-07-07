// Browser-side admin token for backend calls (P0-1). This module is client-safe: it is
// reachable from Client Components, so it must never import server-only code (next/headers).
// api() calls this by default; Server Components supply their token explicitly via
// lib/server-token.ts (which the client bundle never imports).
export async function browserAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null; // server render: token comes in by param
  const { createClient } = await import("./supabase/client");
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.access_token ?? null;
}
