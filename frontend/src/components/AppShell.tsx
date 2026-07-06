import type { ReactNode } from "react";
import Link from "next/link";
import brand from "@/lib/brand";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/cn";

type NavKey = "snapshot" | "plans" | "report" | "knowledge";

const NAV: { key: NavKey; label: string; href: (slug: string) => string; ready: boolean }[] = [
  { key: "snapshot", label: "Company Snapshot", href: (s) => `/w/${s}/snapshot`, ready: true },
  { key: "plans", label: "Interview Plans", href: (s) => `/w/${s}/snapshot`, ready: true },
  { key: "report", label: "Report", href: () => "#", ready: false },
  { key: "knowledge", label: "Knowledge Base", href: () => "#", ready: false },
];

// Left-nav shell shared by every workspace screen. Brand comes from config
// (brand.ts → config/brand.json) — the name is never hardcoded here.
export function AppShell({
  workspace,
  active,
  children,
}: {
  workspace: Workspace;
  active: NavKey;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
        <Link href="/" className="px-2 font-display text-xl text-ink">
          {brand.product_name}
        </Link>

        <div className="mt-8 px-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Workspace
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display text-base text-ink">{workspace.name}</span>
            {workspace.is_demo && (
              <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                Demo
              </span>
            )}
          </div>
          {workspace.industry && (
            <div className="mt-0.5 text-xs capitalize text-ink-faint">
              {workspace.industry}
            </div>
          )}
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const isActive = item.key === active;
            const base =
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors";
            if (!item.ready) {
              return (
                <span
                  key={item.key}
                  className={cn(base, "cursor-default text-ink-faint/60")}
                  title="Coming in a later phase"
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.href(workspace.slug)}
                className={cn(
                  base,
                  isActive
                    ? "bg-accent-soft text-accent-ink"
                    : "text-ink-soft hover:bg-surface-raised hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-2 text-[11px] text-ink-faint">
          Finds context, not solutions.
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
