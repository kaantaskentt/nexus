import type { ReactNode } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  FileText,
  CalendarDays,
  Users,
  BarChart3,
  BookOpen,
  Bell,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import brand from "@/lib/brand";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";

type NavKey = "overview" | "snapshot" | "plans" | "interviews" | "insights" | "knowledge";

const NAV: {
  key: NavKey;
  label: string;
  icon: typeof LayoutGrid;
  href: (slug: string) => string;
  ready: boolean;
}[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid, href: () => "#", ready: false },
  { key: "snapshot", label: "Snapshot", icon: FileText, href: (s) => `/w/${s}/snapshot`, ready: true },
  { key: "plans", label: "Interview Plan", icon: CalendarDays, href: (s) => `/w/${s}/plans`, ready: true },
  { key: "interviews", label: "Interviews", icon: Users, href: () => "#", ready: false },
  { key: "insights", label: "Insights", icon: BarChart3, href: () => "#", ready: false },
  { key: "knowledge", label: "Knowledge Base", icon: BookOpen, href: () => "#", ready: false },
];

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Left-nav shell shared by every workspace screen (stage5/stage6 mockups, V2 bar):
// brand mark + icon nav with a resting/hover/active tri-state, a signed-in-user block,
// and a glass top bar that floats over scrolling content. Brand comes from config.
export function AppShell({
  workspace,
  active,
  children,
}: {
  workspace: Workspace;
  active: NavKey;
  children: ReactNode;
}) {
  const user = workspace.config?.founder ?? `${brand.product_name} Operator`;
  const userRole = workspace.config?.founder_role ?? "Admin";

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r border-line bg-surface">
        <Link
          href="/"
          className="flex items-center gap-1.5 px-6 py-6 transition-opacity hover:opacity-80"
        >
          <span className="font-display text-2xl tracking-tight text-ink">
            {brand.product_name}
          </span>
          <BrandMark className="h-4 w-4 text-accent" />
        </Link>

        <nav className="mt-1 flex flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            const base =
              "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-standard";
            if (!item.ready) {
              return (
                <span
                  key={item.key}
                  className={cn(base, "cursor-default text-ink-faint/80")}
                  title="Coming in a later phase"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.href(workspace.slug)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  base,
                  isActive
                    ? "bg-accent-soft text-accent-ink shadow-elev-1"
                    : "text-ink-soft hover:translate-x-0.5 hover:bg-surface-raised hover:text-ink",
                )}
              >
                {/* Active indicator — a soft accent bar on the leading edge */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Icon
                  className={cn("h-[18px] w-[18px] transition-colors", isActive && "text-accent")}
                  strokeWidth={1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Signed-in user (A11.5 — the client admin's own portal) */}
        <div className="mt-auto p-3">
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-raised p-2.5 shadow-elev-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent/20">
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{user}</div>
              <div className="truncate text-xs text-ink-faint">{userRole}</div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-ink-faint" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-ink">{workspace.name}</span>
            <span className="text-ink-faint">/</span>
            <span className="capitalize text-ink-soft">{active}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="rounded-md p-2 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <button
              className="rounded-md p-2 text-ink-faint transition-colors hover:bg-surface-raised hover:text-ink"
              aria-label="Help"
            >
              <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent/20">
              {initials(user)}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
