// Session refresh + route gate (A17). Runs on every matched request: it refreshes the
// Supabase auth cookie and decides whether the visitor may see an admin surface.
//
// Gated: the workspace picker ("/") and every admin route ("/w/*"). Open BY DESIGN:
// interview links ("/i/*") are token-based and unauthenticated, and the login page
// itself. Static assets are excluded by the matcher in src/middleware.ts.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Prefixes that never require a session. Interview links are the load-bearing one:
// respondents must reach /i/[token] without an admin account (non-negotiable, A17).
// Company-report share links (/r/[token], F2) are public the same way: the token is
// the key, and the backend only serves client-visible, role-only content for it.
const PUBLIC_PREFIXES = ["/login", "/i/", "/r/", "/auth/"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser — it keeps the session fresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in admin never needs the login page — send them to the picker.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
