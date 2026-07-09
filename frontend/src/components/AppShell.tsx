"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Users,
  Network,
  BookOpen,
  BarChart3,
  Layers,
  FlaskConical,
  Settings2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import brand from "@/lib/brand";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { SignOutButton } from "./SignOutButton";

type NavKey =
  | "home"
  | "interviews"
  | "workflows"
  | "context"
  | "insights"
  | "skills"
  | "simulations"
  | "settings";

// The adopted sidebar IA (A21 — Kaan, July 7, from the taste-approved A19 reference set):
// Home / Interviews / Workflows / Company Context / Insights / Agent Skills / Simulations /
// Settings, plus a workspace switcher. Every item routes to a live screen (every-button-
// works); surfaces without data yet render designed, honest empty states, never bare
// headings and never fake content.
const NAV: {
  key: NavKey;
  label: string;
  icon: typeof House;
  href: (slug: string) => string;
}[] = [
  { key: "home", label: "Home", icon: House, href: (s) => `/w/${s}/home` },
  { key: "interviews", label: "Interviews", icon: Users, href: (s) => `/w/${s}/interviews` },
  { key: "workflows", label: "Workflows", icon: Network, href: (s) => `/w/${s}/workflows` },
  { key: "context", label: "Company Context", icon: BookOpen, href: (s) => `/w/${s}/context` },
  { key: "insights", label: "Insights", icon: BarChart3, href: (s) => `/w/${s}/insights` },
  { key: "skills", label: "Agent Skills", icon: Layers, href: (s) => `/w/${s}/skills` },
  { key: "simulations", label: "Simulations", icon: FlaskConical, href: (s) => `/w/${s}/simulations` },
  { key: "settings", label: "Settings", icon: Settings2, href: (s) => `/w/${s}/settings` },
];

// Which nav item a URL segment highlights. Old segment names (snapshot/knowledge) keep
// resolving so stale links land lit rather than lost; plan/report/workflow details light
// their parent section.
const SEG_TO_NAV: Record<string, NavKey> = {
  home: "home",
  snapshot: "home",
  interviews: "interviews",
  plans: "interviews",
  report: "interviews",
  workflows: "workflows",
  workflow: "workflows",
  context: "context",
  knowledge: "context",
  insights: "insights",
  skills: "skills",
  simulations: "simulations",
  settings: "settings",
};

// The breadcrumb reads its section name from the nav label (not a capitalized URL
// segment), so the crumb can never disagree with the sidebar (YC-AUDIT #13). Detail
// segments add a leaf under a linked parent crumb so there's always a way back up.
const NAV_LABEL = Object.fromEntries(NAV.map((n) => [n.key, n.label])) as Record<NavKey, string>;
const NAV_HREF = Object.fromEntries(NAV.map((n) => [n.key, n.href])) as Record<NavKey, (s: string) => string>;
const LEAF_LABEL: Record<string, string> = {
  report: "Report",
  workflow: "Workflow",
  plans: "Plans",
};

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export interface ShellUser {
  name: string;
  email: string;
}

// Left-nav shell shared by every workspace screen: brand mark, workspace switcher, icon
// nav with a resting/hover/active tri-state, the signed-in user block, and a glass top
// bar. Rendered once in the workspace layout so it persists across soft navigations.
//
// The user block shows the REAL authenticated person (EMRE sprint target 1) — resolved
// server-side from the Supabase session and passed in by the layout. It must never fall
// back to the workspace founder: the founder is who the workspace is ABOUT, not who is
// signed in. If auth resolution somehow fails behind the auth wall, we say "Signed in"
// rather than invent an identity.
export function AppShell({
  workspace,
  workspaces = [],
  user,
  role = "admin",
  children,
}: {
  workspace: Workspace;
  workspaces?: Workspace[];
  user?: ShellUser | null;
  // F6 (dormant): a client seat hides the internal machinery (Simulations, Agent
  // Skills, Settings). Defaults to admin — nothing changes unless a caller passes
  // "client", which only the flag-gated layout ever does.
  role?: "admin" | "client";
  children: ReactNode;
}) {
  const navItems =
    role === "client"
      ? NAV.filter((n) => !["simulations", "skills", "settings"].includes(n.key))
      : NAV;
  const pathname = usePathname();
  const seg = pathname.split("/")[3] ?? "home"; // /w/[slug]/<seg>
  const active = SEG_TO_NAV[seg] ?? null;
  const sectionLabel = active ? NAV_LABEL[active] : null;
  const leafLabel = LEAF_LABEL[seg] ?? null; // only on detail pages

  const userName = user?.name ?? "Signed in";
  const userDetail = user?.email ?? "";

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r border-line bg-surface">
        {/* Logo → this workspace's Home (#26): inside a workspace the logo is "take me
            back to the start of THIS company" — the picker stays one click away via the
            switcher's "All companies". */}
        <Link
          href={`/w/${workspace.slug}/home`}
          className="flex items-center gap-1.5 px-6 pb-3 pt-6 transition-opacity hover:opacity-80"
        >
          <span className="font-display text-2xl tracking-tight text-ink">
            {brand.product_name}
          </span>
          <BrandMark className="h-4 w-4 text-accent" />
        </Link>

        <WorkspaceSwitcher current={workspace} all={workspaces} />

        <nav className="mt-2 flex flex-col gap-0.5 px-3">
          {navItems.map((item) => {
            const isActive = item.key === active;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href(workspace.slug)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-standard",
                  isActive
                    ? "bg-accent-soft text-accent-ink shadow-elev-1"
                    : "text-ink-soft hover:translate-x-0.5 hover:bg-surface-raised hover:text-ink",
                )}
              >
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

        {/* Signed-in user — the real authenticated person, never the workspace founder. */}
        <div className="mt-auto p-3">
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-raised p-2.5 shadow-elev-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent/20">
              {initials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{userName}</div>
              {userDetail && (
                <div className="truncate text-xs text-ink-faint">{userDetail}</div>
              )}
            </div>
          </div>
          <SignOutButton variant="row" className="mt-1" />
          {/* F5 Trust Center: footer territory per Kaan (privacy/policy placement) —
              a quiet link, deliberately outside the main nav. */}
          <Link
            href={`/w/${workspace.slug}/trust`}
            className="mt-2 block px-3 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            Trust Center: how your people&apos;s words are handled
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-8">
          {/* Breadcrumbs are all real links except the current leaf (#26): company →
              workspace Home, section → its index — every crumb is a way back up. */}
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/w/${workspace.slug}/home`}
              className="font-medium text-ink transition-colors hover:text-accent-ink"
            >
              {workspace.name}
            </Link>
            {sectionLabel && active && (
              <>
                <span className="text-ink-faint">/</span>
                {leafLabel ? (
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
          <div
            title={userDetail ? `${userName} · ${userDetail}` : userName}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent/20"
          >
            {initials(userName)}
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

// ── Workspace switcher ──────────────────────────────────────────────────────
// A compact dropdown under the brand: current company, and one click to any other the
// admin can see. Lands on the target workspace's Home. Closes on outside click/Escape.
function WorkspaceSwitcher({ current, all }: { current: Workspace; all: Workspace[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = all.filter((w) => w.id !== current.id);

  return (
    <div ref={rootRef} className="relative px-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-md border border-line bg-surface-raised px-2.5 py-2 text-left shadow-elev-1 transition-colors hover:border-line-strong"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-ink ring-1 ring-inset ring-accent/15">
          {initials(current.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
          {current.name}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-3 right-3 z-40 mt-1.5 overflow-hidden rounded-md border border-line bg-surface shadow-elev-2"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            <Link
              href={`/w/${current.slug}/home`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-raised"
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
              <span className="truncate font-medium">{current.name}</span>
            </Link>
            {others.map((w) => (
              <Link
                key={w.id}
                href={`/w/${w.slug}/home`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:bg-surface-raised hover:text-ink"
              >
                <span className="w-3.5 shrink-0" />
                <span className="truncate">{w.name}</span>
              </Link>
            ))}
          </div>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-3 py-2 text-xs font-medium text-ink-faint hover:bg-surface-raised hover:text-ink"
          >
            All companies
          </Link>
        </div>
      )}
    </div>
  );
}
