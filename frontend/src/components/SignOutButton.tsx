"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

// Sign out (A17). Posts to the /auth/signout route handler, which clears the Supabase
// cookies and redirects to /login. A plain form POST keeps it working without JS and
// avoids a drive-by GET logout. `variant` lets the picker and the shell share it.
export function SignOutButton({
  variant = "ghost",
  className,
  // `touch` guarantees a ≥44px tap target when the button lives in the mobile nav
  // drawer. Off by default, so the picker/desktop rows stay byte-identical.
  touch = false,
}: {
  variant?: "ghost" | "row";
  className?: string;
  touch?: boolean;
}) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium transition-colors",
          variant === "ghost"
            ? "rounded-md px-3 py-1.5 text-ink-soft hover:bg-surface-raised hover:text-ink"
            : "w-full rounded-md px-3 py-2 text-ink-soft hover:bg-surface-raised hover:text-ink",
          touch && "min-h-[44px]",
        )}
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        Sign out
      </button>
    </form>
  );
}
