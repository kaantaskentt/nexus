import { notFound } from "next/navigation";
import Link from "next/link";
import { FlaskConical, Mic, MessageSquare, Users, History, ShieldCheck, ArrowRight } from "lucide-react";
import {
  get_workspace,
  list_simulations,
  get_simulation_history,
  list_roleplay,
  get_scenarios,
} from "@/lib/live-server";
import { RolePlaySection } from "@/components/simulations/RolePlaySection";
import { ScenariosSection } from "@/components/simulations/ScenariosSection";
import brand from "@/lib/brand";

// Simulations (A21 IA / SIMPLIFY I): workspace-scoped. The page leads with scenarios derived
// from THIS company's real workflows (pressure-test the interviewer against the work it will
// actually ask about). The product-wide proving record (global cast + judged rounds + the
// cast role-play) is kept for the trust moment but relocated behind a quiet "How Nexus is
// tested" disclosure so a new tenant never meets someone else's example as their own content.
// Roleplay/scenario sessions are firewalled from compile server-side (session_kind).
export const dynamic = "force-dynamic";

export default async function SimulationsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [runs, history, roleplayRuns, scenarios] = await Promise.all([
    list_simulations(workspace.id),
    get_simulation_history().catch(() => null),
    list_roleplay(workspace.id).catch(() => []),
    get_scenarios(workspace.id).catch(() => []),
  ]);

  const hasCast = Boolean(history && history.cast.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Simulations</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
        Pressure-test the interviewer against your own workflows before a real person ever
        gets a link. Nothing said in a simulation touches your company records.
      </p>

      {scenarios.length > 0 ? (
        <ScenariosSection workspaceId={workspace.id} scenarios={scenarios} />
      ) : (
        <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-14 text-center">
          <FlaskConical className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
          <p className="mt-4 font-display text-xl text-ink">No workflows to practice against yet</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            A simulation drills the interviewer against a real workflow from this company.
            None are mapped yet. Run an interview and its workflow appears here to practice
            against.
          </p>
          <Link
            href={`/w/${workspace.slug}/interviews`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-elev-1 transition-all duration-150 ease-standard hover:-translate-y-px hover:bg-accent-hover"
          >
            Go to interviews <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
          <FlaskConical className="h-4 w-4" strokeWidth={1.75} /> Runs in this workspace
        </h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            No simulations have been run in this workspace yet. Run one above and it appears here.
          </p>
        ) : (
          <div className="card-hairline mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {runs.map((r) => {
              const Icon = r.modality === "voice" ? Mic : MessageSquare;
              return (
                <div key={r.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink ring-1 ring-inset ring-accent/15">
                    <FlaskConical className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">
                      {r.interviewee_name ?? "Simulated respondent"}
                      {r.interviewee_role && (
                        <span className="font-normal text-ink-faint"> · {r.interviewee_role}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span className="capitalize">{r.modality}</span> simulation ·{" "}
                      <span className="capitalize">{r.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Relocated product-wide proving record (SIMPLIFY I, Kaan confirm #3): kept for the
          in-context trust moment, demoted behind a quiet disclosure so it is never mistaken
          for this company's data. simulation_history + roleplay endpoints unchanged. */}
      {hasCast && (
        <details className="mt-10 rounded-card border border-line bg-surface-sunken/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink-soft hover:text-ink">
            How {brand.product_name} is tested
          </summary>
          <div className="border-t border-line px-4 pb-5 pt-4">
            <p className="max-w-2xl text-xs leading-relaxed text-ink-soft">
              The cast and proving rounds below are {brand.product_name}&apos;s own product-wide
              testing record. The same interviewer serves every company, so these results apply
              here too. They are not data from {workspace.name}.
            </p>

            <section className="mt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
                <Users className="h-4 w-4" strokeWidth={1.75} /> The cast
              </h3>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {history!.cast.map((c) => (
                  <div key={c.key} className="card-hairline rounded-card border border-line bg-surface p-4">
                    <div className="font-medium text-ink">{c.role}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{c.style}</div>
                    <div className="mt-2 text-xs leading-relaxed text-ink-faint">Tests: {c.tests}</div>
                  </div>
                ))}
              </div>
            </section>

            <RolePlaySection
              workspaceId={workspace.id}
              cast={history!.cast}
              initialRuns={roleplayRuns}
            />

            {history!.rounds.length > 0 && (
              <section className="mt-8">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  <History className="h-4 w-4" strokeWidth={1.75} /> Proving rounds
                </h3>
                <div className="card-hairline mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {history!.rounds.map((r) => (
                    <div key={r.round} className="px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-ink">
                          Round {r.round}
                          <span className="font-normal text-ink-faint"> · {r.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!r.complete && (
                            <span className="rounded-chip bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-faint ring-1 ring-inset ring-ink/[0.04]">
                              Partial run
                            </span>
                          )}
                          <span className="text-xs text-ink-faint">{r.date}</span>
                        </div>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
                        The interviewer surfaced {r.surfaced} of {r.surfaced_total} hidden facts
                        {r.traps_taken === 0
                          ? " and took zero bait."
                          : ` and took ${r.traps_taken} of ${r.traps_total} misleading cues.`}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-ink-faint">
                        <span className="tabular">{r.surfaced}/{r.surfaced_total} hidden facts</span>
                        <span className="tabular inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-tag-verified" strokeWidth={1.75} />
                          {r.traps_taken}/{r.traps_total} cues taken
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-soft">{r.note}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
