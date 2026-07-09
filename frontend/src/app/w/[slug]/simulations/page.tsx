import { notFound } from "next/navigation";
import { FlaskConical, Mic, MessageSquare, Users, History, ShieldCheck } from "lucide-react";
import { get_workspace, list_simulations, get_simulation_history } from "@/lib/live-server";
import brand from "@/lib/brand";

// Simulations (A21 IA / task #28): interviews run against SIMULATED respondents —
// persona-driven test runs (session_kind='eval') used to pressure-test the interviewer
// before any real employee sees it. The eval firewall (0007) keeps these strictly
// separate from real interviews. This page renders three things: a plain-language
// explainer, the proving history (cast + judged rounds, served from the versioned
// backend record), and this workspace's own eval runs. HONEST v1 stands: runs are
// launched by the Nexus eval harness — a Run button remains PROPOSED, not built.
export const dynamic = "force-dynamic";

export default async function SimulationsPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [runs, history] = await Promise.all([
    list_simulations(workspace.id),
    get_simulation_history().catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Simulations</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
        Practice interviews against simulated employees: realistic characters that
        pressure-test the interviewer before a real person ever gets a link. Each
        character knows things it was told <em>not</em> to volunteer, and each drops a few
        misleading cues on purpose. A run is scored on both: did the interviewer earn the
        hidden facts, and did it take any bait? Simulated runs are kept fully separate
        from your company&apos;s real records: nothing said here enters your company context.
      </p>
      {/* Global-vs-workspace framing (Kaan queue, July 8): the cast and rounds are the
          PRODUCT's proving record, not this company's data — say so before a new tenant
          reads identical content as "stuck". Full rethink: docs/SIMULATIONS-RETHINK.md. */}
      <p className="mt-3 max-w-2xl rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
        The cast and proving rounds below are {brand.product_name}&apos;s own product-wide
        testing record. The same interviewer serves every company, so these results apply
        here too. They are not data from {workspace.name}.
      </p>

      {history && history.cast.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
            <Users className="h-4 w-4" strokeWidth={1.75} /> The cast
          </h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {history.cast.map((c) => (
              <div key={c.key} className="card-hairline rounded-card border border-line bg-surface p-4">
                <div className="font-medium text-ink">{c.role}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{c.style}</div>
                <div className="mt-2 text-xs leading-relaxed text-ink-faint">
                  Tests: {c.tests}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {history && history.rounds.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
            <History className="h-4 w-4" strokeWidth={1.75} /> Proving rounds
          </h2>
          <div className="card-hairline mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {history.rounds.map((r) => (
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
                {/* Plain language leads (Kaan queue): a sentence a CEO reads at a
                    glance; the raw counts follow as secondary detail. */}
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

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-ink-faint">
          <FlaskConical className="h-4 w-4" strokeWidth={1.75} /> Runs in this workspace
        </h2>
        {runs.length === 0 ? (
          <div className="card-hairline mt-3 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-14 text-center">
            <FlaskConical className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
            <p className="mt-4 font-display text-xl text-ink">No simulations run here yet</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              Simulated interviews are run with the Nexus team during onboarding and before
              big interview rounds. Ask us to pressure-test your plan. Runs and their
              results appear here.
            </p>
          </div>
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
    </div>
  );
}
