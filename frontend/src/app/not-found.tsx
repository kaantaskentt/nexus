import Link from "next/link";
import { Compass } from "lucide-react";
import brand from "@/lib/brand";

// Global branded not-found (Kaan ruling, July 8): even outside a workspace, a dead
// address gets product chrome and a way home, never the bare Next 404.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/20">
        <Compass className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 font-display text-xl text-ink">This page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        The link may be old, or the workspace it pointed at is no longer available.
        Everything {brand.product_name} holds for you is one click away.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
      >
        Your companies
      </Link>
    </div>
  );
}
