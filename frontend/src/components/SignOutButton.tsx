"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

// Sign out (A17). Posts to the /auth/signout route handler, which clears the Supabase
// cookies and redirects to /login. A plain form POST keeps it working without JS and
// avoids a drive-by GET logout. `variant` lets the picker and the shell share it.
export function SignOutButton({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "row";
  className?: string;
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
        )}
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        Sign out
      </button>
    </form>
  );
}
