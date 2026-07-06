import Link from "next/link";
import brand from "@/lib/brand";
import { list_workspaces } from "@/lib/mocks";

// Workspace picker (A11.5 — no auth v1): seeded company cards, click to enter.
// Matches the mockup's "click your admin portal" pattern; is_demo badge marks the
// demo tenant so a real engagement is never confused with the fictional storyline.
export default async function Home() {
  const workspaces = await list_workspaces();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-20">
      <header className="text-center">
        <h1 className="font-display text-5xl text-ink">{brand.product_name}</h1>
        <p className="mt-3 text-ink-soft">
          A world-class interviewer and context extractor.
        </p>
      </header>

      <div className="mx-auto mt-12 max-w-md">
        <div className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Choose a workspace
        </div>
        <ul className="flex flex-col gap-3">
          {workspaces.map((ws) => {
            const enabled = ws.is_demo; // only the demo tenant carries fixture data in v1
            const card = (
              <div
                className={
                  "group flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-card transition-colors " +
                  (enabled
                    ? "hover:border-line-strong hover:bg-surface-raised"
                    : "opacity-70")
                }
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft font-display text-lg text-accent-ink">
                    {ws.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg text-ink">{ws.name}</span>
                      {ws.is_demo && (
                        <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                          Demo
                        </span>
                      )}
                    </div>
                    {ws.industry && (
                      <div className="text-xs capitalize text-ink-faint">
                        {ws.industry}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-sm text-ink-faint group-hover:text-accent">
                  {enabled ? "Enter →" : "No data yet"}
                </span>
              </div>
            );

            return (
              <li key={ws.id}>
                {enabled ? (
                  <Link href={`/w/${ws.slug}/snapshot`}>{card}</Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-center text-xs text-ink-faint">
          Internal workspace picker. Interview links are token-based and never appear here.
        </p>
      </div>
    </main>
  );
}
