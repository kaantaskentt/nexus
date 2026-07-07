import "server-only";
// The signed-in person, resolved server-side from the request's Supabase session (EMRE
// sprint target 1). The shell's user card must show the REAL authenticated user — never
// the workspace founder and never a generic operator label. Display name preference:
// explicit profile name → email local-part (title-cased) → the email itself.
import { createClient } from "./supabase/server";

export interface SignedInUser {
  name: string;
  email: string;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

export async function signedInUser(): Promise<SignedInUser | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user?.email) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    null;
  return { name: metaName || nameFromEmail(user.email), email: user.email };
}
