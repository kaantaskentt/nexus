"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import brand from "@/lib/brand";

// Admin login (A17). Minimal real auth: Supabase email + password, no signup — admins
// are created manually. On success the middleware sees the session cookie and lets the
// admin into the picker; interview links stay open and never pass through here.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Those credentials did not match. Check your email and password.");
      setSubmitting(false);
      return;
    }
    // Full navigation so the middleware re-runs with the fresh session cookie.
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto h-9 w-9 text-accent" />
          <h1 className="mt-5 font-display text-3xl text-ink">
            Sign in to {brand.product_name}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">Admin access to your workspaces</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="card-hairline rounded-card border border-line bg-surface p-6 shadow-elev-2"
        >
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.com"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your password"
            />
          </label>

          {error && (
            <p className="mb-4 rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover hover:shadow-elev-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                Signing in
              </>
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
          Secure. Private. Your data stays yours.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary under the App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginForm />
    </Suspense>
  );
}
