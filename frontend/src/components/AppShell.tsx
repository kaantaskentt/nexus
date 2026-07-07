"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  CalendarDays,
  Users,
  BarChart3,
  BookOpen,
} from "lucide-react";
import brand from "@/lib/brand";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { SignOutButton } from "./SignOutButton";

type NavKey = "snapshot" | "plans" | "interviews" | "insights" | "knowledge";

// Every item routes to a live screen. The former "Overview" item was removed rather than
// left dead: the Company Snapshot IS the workspace landing (the picker opens straight to
// it), so a separate Overview only duplicated it (named deviation, docs/FOR-TUNC.md).
const NAV: {
  key: NavKey;
  label: string;
  icon: typeof FileText;
  href: (slug: string) => string;
  ready: boolean;
}[] = [
  { key: "snapshot", label: "Snapshot", icon: FileText, href: (s) => `/w/${s}/snapshot`, ready: true },
  { key: "plans", label: "Interview Plans", icon: CalendarDays, href: (s) => `/w/${s}/plans`, ready: true },
  { key: "interviews", label: "Interviews", icon: Users, href: (s) => `/w/${s}/interviews`, ready: true },
  { key: "insights", label: "Insights", icon: BarChart3, href: (s) => `/w/${s}/insights`, ready: true },
  { key: "knowledge", label: "Knowledge Base", icon: BookOpen, href: (s) => `/w/${s}/knowledge`, ready: true },
];

// Which nav item a URL segment highlights. report/workflow are reached from a plan, so
// they keep the Interview Plans item lit; everything else maps to its own item.
const SEG_TO_NAV: Record<string, NavKey> = {
  snapshot: "snapshot",
  plans: "plans",
  interviews: "interviews",
  insights: "insights",
  knowledge: "knowledge",
  report: "plans",
  workflow: "plans",
};

// The breadcrumb reads its section name from the nav label (not a capitalized URL
// segment), so the crumb can never disagree with the sidebar — "Knowledge Base", never
// "Knowledge" (YC-AUDIT #13). Detail segments (report/workflow) add a leaf under a linked
// parent crumb so there's always a way back up.
const NAV_LABEL = Object.fromEntries(NAV.map((n) => [n.key, n.label])) as Record<NavKey, string>;
const NAV_HREF = Object.fromEntries(NAV.map((n) => [n.key, n.href])) as Record<NavKey, (s: string) => string>;
const LEAF_LABEL: Record<string, string> = { report: "Report", workflow: "Workflow" };

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Left-nav shell shared by every workspace screen (stage5/stage6 mockups, V2 bar):
// brand mark + icon nav with a resting/hover/active tri-state, a signed-in-user block,
// and a glass top bar that floats over scrolling content. Rendered once in the
// workspace layout so it persists across soft navigations (no per-page re-mount, no
// nav flash); the active item is derived from the pathname rather than a passed prop.
export function AppShell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const seg = pathname.split("/")[3] ?? "snapshot"; // /w/[slug]/<seg>
  const active = SEG_TO_NAV[seg] ?? null;
  const sectionLabel = active ? NAV_LABEL[active] : null;
  const leafLabel = LEAF_LABEL[seg] ?? null; // set only on report/workflow detail pages

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
          </div>
          <SignOutButton variant="row" className="mt-1" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-ink">{workspace.name}</span>
            {sectionLabel && (
              <>
                <span className="text-ink-faint">/</span>
                {/* On a detail page the section becomes a link back up; otherwise it's the
                    current location and stays plain text. */}
                {leafLabel && active ? (
                  <Link
                    href={NAV_HREF[active](workspace.slug)}
                    className="text-ink-soft transition-colors hover:text-ink"
                  >
                    {sectionLabel}
                  </Link>
                ) : (
                  <span className="text-ink-soft">{sectionLabel}</span>
                )}
              </>
            )}
            {leafLabel && (
              <>
                <span className="text-ink-faint">/</span>
                <span className="text-ink-soft">{leafLabel}</span>
              </>
            )}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent/20">
            {initials(user)}
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
