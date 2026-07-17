import "server-only";
// Server-side admin token, read from the request's Supabase session cookie. `server-only`
// makes any accidental import from a Client Component a build error — which is why this
// lives apart from api.ts/live.ts (both reachable from Client Components and therefore
// forbidden from touching next/headers). Server Components pass this token into the
// lib/live-server.ts wrappers.
import { createClient } from "./supabase/server";

export async function serverAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
