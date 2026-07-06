import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Admin-auth gate (A17). Delegates to updateSession, which refreshes the Supabase
// session and redirects unauthenticated visitors off admin surfaces to /login.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static asset files. Interview links
  // (/i/*) DO pass through here, but updateSession treats them as public by design.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)",
  ],
};
