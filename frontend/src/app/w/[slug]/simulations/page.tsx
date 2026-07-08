import { notFound } from "next/navigation";
import { FlaskConical, Mic, MessageSquare } from "lucide-react";
import { get_workspace, list_simulations } from "@/lib/live-server";

// Simulations (A21 IA): interviews run against SIMULATED respondents — persona-driven
// test runs (session_kind='eval') used to pressure-test an interview plan before any real
// employee sees it. The eval firewall (0007) keeps these strictly separate from real
// interviews; nothing here ever counts toward the company's record. HONEST v1: runs are
// launched by the Nexus eval harness today (no in-app run button that wouldn't work);
// results land here as they exist.
export const dynamic = "force-dynamic";

export default async function SimulationsPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const runs = await list_simulations(workspace.id);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Simulations</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
        Practice interviews against simulated employees: realistic personas that pressure-test
        an interview plan before a real person ever gets a link. It&apos;s how we train and
        test the interviewer. Simulated runs are kept fully separate from your company&apos;s
        real records: nothing said here enters your company context.
      </p>

      {runs.length === 0 ? (
        <div className="card-hairline mt-8 flex flex-col items-center rounded-card border border-line bg-surface px-8 py-20 text-center">
          <FlaskConical className="h-9 w-9 text-ink-faint/60" strokeWidth={1.5} />
          <p className="mt-4 font-display text-xl text-ink">No simulations run yet</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Simulated interviews are run with the Nexus team during onboarding and before big interview rounds. Ask us to
            pressure-test your plan. Runs and their results appear here.
          </p>
        </div>
      ) : (
        <div className="card-hairline mt-8 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
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
    </div>
  );
}
