// Browser Supabase client (A17 admin auth). Used by client components — the login
// form and the sign-out affordance. The publishable/anon key is safe in the browser;
// row access is governed server-side, and this app only uses Supabase for auth.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
