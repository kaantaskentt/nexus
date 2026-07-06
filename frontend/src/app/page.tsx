import Link from "next/link";
import {
  User,
  Gem,
  Compass,
  Users,
  Sparkles,
  Database,
  ArrowRight,
  Lock,
  Check,
} from "lucide-react";
import brand from "@/lib/brand";
import { list_workspaces, list_plans, list_snapshot_cards } from "@/lib/live";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/SignOutButton";

// Workspace picker (A11.5 — no auth v1). Matches the right panel of
// stage5-signin-workspace-picker.png: a centered welcome and a prepared-pilot
// workspace card. The sign-in panel on the left of the mockup is intentionally
// omitted — there is no auth in v1. Meta counts render from real seeded records.
export default async function Home() {
  const workspaces = await list_workspaces();

  // Pull counts per workspace so the card reflects real records, not hardcoded JSX.
  const withCounts = await Promise.all(
    workspaces.map(async (ws) => {
      const [plans, cards] = await Promise.all([
        list_plans(ws.id),
        list_snapshot_cards(ws.id),
      ]);
      return {
        ws,
        interviews: plans.length,
        areas: cards.filter((c) => c.card_type === "area_to_investigate").length,
        prepared: cards.length > 0,
      };
    }),
  );

  const hero = withCounts.find((w) => w.prepared) ?? withCounts[0];
  const others = withCounts.filter((w) => w !== hero);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center justify-end gap-2 px-8">
        <SignOutButton />
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-10 text-center">
        <BrandMark className="mx-auto h-8 w-8 text-accent" />
        <h1 className="mt-6 font-display text-5xl text-ink">
          Welcome to {brand.product_name}
        </h1>
        <p className="mt-3 font-display text-2xl text-ink-soft">Choose your workspace</p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
          Your pilot workspace has been prepared and is ready. Jump in to explore your
          snapshot, interview plans, and insights.
        </p>

        <div className="mt-10 text-left">
          <HeroCard {...hero} />
        </div>

        {others.length > 0 && (
          <div className="mt-6 text-left">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Other workspaces
            </div>
            <ul className="space-y-2">
              {others.map(({ ws }) => (
                <li
                  key={ws.id}
                  className="card-hairline flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3 opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised font-display text-sm text-ink-soft">
                      {ws.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">{ws.name}</div>
                      <div className="text-xs capitalize text-ink-faint">{ws.industry}</div>
                    </div>
                  </div>
                  <span className="text-xs text-ink-faint">Not yet started</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
          Secure. Private. Your data stays yours.
        </p>
      </main>
    </div>
  );
}

function HeroCard({
  ws,
  interviews,
  areas,
}: {
  ws: Awaited<ReturnType<typeof list_workspaces>>[number];
  interviews: number;
  areas: number;
}) {
  const c = ws.config ?? {};
  return (
    <Link
      href={`/w/${ws.slug}/snapshot`}
      className="lift group block rounded-card border border-line bg-surface p-6 hover:border-line-strong"
    >
      <div className="flex items-start gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface-raised font-display text-2xl leading-none text-ink">
          {ws.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl text-ink">{ws.name}</h2>
            {c.approved_for_pilot && (
              <span className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-tag-verified">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Approved for pilot
              </span>
            )}
          </div>

          <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
            {c.founder && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
                <span>
                  {c.founder}
                  {c.founder_role && (
                    <span className="text-ink-faint"> · {c.founder_role}</span>
                  )}
                </span>
              </div>
            )}
            {c.tagline && (
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
                <span>{c.tagline}</span>
              </div>
            )}
            {c.starting_focus && (
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
                <span>
                  Starting focus: <span className="text-ink">{c.starting_focus}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <NodeGraph className="hidden h-24 w-28 shrink-0 text-accent sm:block" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
        <Meta icon={Users} label={`${interviews} suggested interviews`} />
        <Meta icon={Sparkles} label={`${areas} areas to investigate`} />
        <Meta icon={Database} label="Context seeded from discovery call" />
        <span className="ml-auto inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard group-hover:-translate-y-px group-hover:bg-accent-hover group-hover:shadow-elev-2">
          Enter workspace
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

function Meta({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <Icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
      {label}
    </span>
  );
}

// Small process-graph flourish echoing the mockup — one node linking to two,
// a subtle nod to the knowledge graph the product builds (comprehension, not decoration).
function NodeGraph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 112 96" fill="none" className={className} aria-hidden>
      <path d="M40 48h20M60 32h18M60 64h18" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="8" y="34" width="30" height="28" rx="7" fill="currentColor" opacity="0.12" />
      <rect x="8" y="34" width="30" height="28" rx="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 48l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="78" y="20" width="26" height="22" rx="6" fill="currentColor" opacity="0.1" />
      <rect x="78" y="20" width="26" height="22" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="78" y="54" width="26" height="22" rx="6" fill="currentColor" opacity="0.1" />
      <rect x="78" y="54" width="26" height="22" rx="6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
