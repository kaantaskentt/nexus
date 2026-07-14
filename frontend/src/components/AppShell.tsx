"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  House,
  Users,
  ContactRound,
  Network,
  BookOpen,
  FlaskConical,
  Settings2,
  ChevronsUpDown,
  Check,
  Menu,
} from "lucide-react";
import brand from "@/lib/brand";
import type { Workspace } from "@/lib/types";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/initials";
import { drawerSpring, scrimFade } from "@/lib/variants";
import { useEscapeClose } from "@/lib/useEscapeClose";
import { BrandMark } from "./BrandMark";
import { SignOutButton } from "./SignOutButton";

type NavKey =
  | "home"
  | "people"
  | "interviews"
  | "workflows"
  | "context"
  | "skills"
  | "simulations"
  | "settings";

// The adopted sidebar IA (A21 — Kaan, July 7, from the taste-approved A19 reference set),
// after the ADD-3.3 Insights fold + People roster: Home / People / Interviews / Workflows /
// Company Context / Simulations / Settings, plus a workspace switcher. Insights folded into
// Home (findings/conflicts/opportunities on the Company Snapshot). People is the durable
// entity roster (edit info, invite to interview) — not F6 app seats. Every item routes to a
// live screen (every-button-works); empty states stay designed and honest.
const NAV: {
  key: NavKey;
  label: string;
  icon: typeof House;
  href: (slug: string) => string;
}[] = [
  { key: "home", label: "Home", icon: House, href: (s) => `/w/${s}/home` },
  { key: "people", label: "People", icon: ContactRound, href: (s) => `/w/${s}/people` },
  { key: "interviews", label: "Interviews", icon: Users, href: (s) => `/w/${s}/interviews` },
  { key: "workflows", label: "Workflows", icon: Network, href: (s) => `/w/${s}/workflows` },
  { key: "context", label: "Company Context", icon: BookOpen, href: (s) => `/w/${s}/context` },
  { key: "simulations", label: "Simulations", icon: FlaskConical, href: (s) => `/w/${s}/simulations` },
  { key: "settings", label: "Settings", icon: Settings2, href: (s) => `/w/${s}/settings` },
];

// Which nav item a URL segment highlights. Old segment names (snapshot/knowledge) keep
// resolving so stale links land lit rather than lost; plan/report/workflow details light
// their parent section.
const SEG_TO_NAV: Record<string, NavKey> = {
  home: "home",
  snapshot: "home",
  people: "people",
  interviews: "interviews",
  plans: "interviews",
  report: "interviews",
  workflows: "workflows",
  workflow: "workflows",
  context: "context",
  knowledge: "context",
  insights: "home", // Insights folded into Home (ADD-3.3) — a stale /insights link lights Home
  skills: "workflows", // Agent Skills folded into Workflows (Kaan-approved proposal 2)
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
  trust: "Trust Center", // footer-linked page (F5) — crumb matches every other page
};


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
  // F6: a client seat hides the internal machinery (Simulations, Settings).
  // Defaults to admin when no user_roles row exists.
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

  // Below lg the sidebar collapses into a hamburger-triggered slide-over drawer; at lg+
  // there is no drawer and the desktop aside is unchanged. The drawer closes on nav-click
  // (onNavigate), Escape, scrim-tap, and — as a catch-all — on any route change.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useEscapeClose(drawerOpen, closeDrawer);
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Desktop sidebar — byte-identical at lg+; hidden below lg where the drawer takes
          over. `lg:flex` restores the exact resting layout Kaan demos on. */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <SidebarBody
          workspace={workspace}
          workspaces={workspaces}
          navItems={navItems}
          active={active}
          userName={userName}
          userDetail={userDetail}
        />
      </aside>

      {/* Mobile nav drawer (below lg only): the SAME sidebar body slides in from the left
          over a scrim, using the shared drawerSpring/scrimFade vocabulary. */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="lg:hidden">
            <motion.div
              variants={scrimFade}
              initial="hidden"
              animate="show"
              exit="hidden"
              onClick={closeDrawer}
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-scrim backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={drawerSpring}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[82%] flex-col border-r border-line bg-surface shadow-elev-3"
            >
              <SidebarBody
                workspace={workspace}
                workspaces={workspaces}
                navItems={navItems}
                active={active}
                userName={userName}
                userDetail={userDetail}
                onNavigate={closeDrawer}
                touch
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header (below lg): hamburger + workspace name + breadcrumb-lite. */}
        <header className="glass sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link
              href={`/w/${workspace.slug}/home`}
              className="shrink-0 truncate font-medium text-ink transition-colors hover:text-accent-ink"
            >
              {workspace.name}
            </Link>
            {sectionLabel && active && (
              <>
                <span className="shrink-0 text-ink-faint">/</span>
                <span className="truncate text-ink-soft">{leafLabel ?? sectionLabel}</span>
              </>
            )}
          </div>
        </header>

        {/* Desktop header — byte-identical at lg+; hidden below lg. */}
        <header className="glass sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between gap-4 border-b px-8 lg:flex">
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
            {initials(userName, "?")}
          </div>
        </header>
        <ProviderHealthBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

// The sidebar's inner content — logo, workspace switcher, nav, and the signed-in/footer
// block. Rendered in BOTH the desktop aside and the mobile drawer so the two never drift.
// `onNavigate` fires on every in-drawer navigation (closes the drawer); `touch` grows the
// tap targets to ≥44px for the drawer. With both omitted (the desktop call) the output is
// byte-identical to the pre-drawer shell.
function SidebarBody({
  workspace,
  workspaces,
  navItems,
  active,
  userName,
  userDetail,
  onNavigate,
  touch = false,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  navItems: typeof NAV;
  active: NavKey | null;
  userName: string;
  userDetail: string;
  onNavigate?: () => void;
  touch?: boolean;
}) {
  return (
    <>
      {/* Logo → this workspace's Home (#26): inside a workspace the logo is "take me
          back to the start of THIS company" — the picker stays one click away via the
          switcher's "All companies". */}
      <Link
        href={`/w/${workspace.slug}/home`}
        onClick={onNavigate}
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
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150 ease-standard",
                isActive
                  ? "bg-accent-soft text-accent-ink shadow-elev-1"
                  : "text-ink-soft hover:translate-x-0.5 hover:bg-surface-raised hover:text-ink",
                touch && "min-h-[44px]",
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
            {initials(userName, "?")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{userName}</div>
            {userDetail && (
              <div className="truncate text-xs text-ink-faint">{userDetail}</div>
            )}
          </div>
        </div>
        <SignOutButton variant="row" className="mt-1" touch={touch} />
        {/* F5 Trust Center: footer territory per Kaan (privacy/policy placement) —
            a quiet link, deliberately outside the main nav. */}
        <Link
          href={`/w/${workspace.slug}/trust`}
          onClick={onNavigate}
          className={cn(
            "mt-2 px-3 text-xs text-ink-faint transition-colors hover:text-ink",
            touch ? "flex min-h-[44px] items-center" : "block",
          )}
        >
          Trust Center: how your people&apos;s words are handled
        </Link>
      </div>
    </>
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
          {initials(current.name, "?")}
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

// ── Provider health banner (WS-5, round-2 addendum §1) ────────────────────────────────
// The July 10 credit exhaustion failed silently in three costumes; nobody should spend an
// evening diagnosing an empty tank. The worker names provider failures on the queue and
// /health/deep surfaces the freshest one — this banner says the true thing, in product
// language, on every admin screen. Polls once a minute; renders nothing when healthy.
const PROVIDER_COPY: Record<string, string> = {
  PROVIDER_CREDITS_EXHAUSTED:
    "AI provider credits are exhausted. Nothing is lost: work is queued and resumes automatically after a top-up.",
  PROVIDER_AUTH:
    "The AI provider is rejecting our credentials. Queued work will resume once the key is fixed.",
  PROVIDER_RATE_LIMITED:
    "The AI provider is rate-limiting us. Work is queued and retrying automatically.",
  PROVIDER_OVERLOADED:
    "The AI provider is temporarily unavailable. Work is queued and retrying automatically.",
};

function ProviderHealthBanner() {
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const res = await fetch(`${base}/health/deep`, { cache: "no-store" });
        if (!res.ok) return;
        const d = (await res.json()) as { provider_error?: string | null };
        if (alive) setKind(d.provider_error ?? null);
      } catch {
        /* health probe failing is not a provider outage; keep the last state */
      }
    }
    void tick();
    const id = window.setInterval(tick, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (!kind) return null;
  return (
    <div
      role="status"
      className="border-b border-danger/30 bg-danger-soft px-6 py-2.5 text-sm text-ink"
    >
      <span className="font-semibold text-danger">AI provider issue.</span>{" "}
      {PROVIDER_COPY[kind] ??
        "The AI provider is failing requests. Work is queued and retrying automatically."}
    </div>
  );
}
