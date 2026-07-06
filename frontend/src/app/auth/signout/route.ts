import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sign out (A17). A route handler (not a Server Component) so it can clear the auth
// cookies, then bounce back to /login. POST-only to avoid drive-by logout via a GET.
export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
