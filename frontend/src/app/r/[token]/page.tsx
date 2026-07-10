import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { get_company_report } from "@/lib/live";
import type { CompanyReport, CompanyReportStep } from "@/lib/live";
import { PainBandChip } from "@/components/PainBandChip";
import brand from "@/lib/brand";
import { PrintButton } from "./PrintButton";

// F2 Monday Morning Report: the shareable, print-ready Company Report. PUBLIC by
// design (the share token is the key, same posture as /i/[token]); composed at read
// time by the backend so a forwarded link always shows the current truth. Branding
// decision (Kaan delegation): the CLIENT's name owns the header, {brand} keeps a quiet
// footer. Attribution in this document is role-only, enforced server-side.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Company Report" };

const GAP_LABEL: Record<string, string> = {
  ceo_vs_floor: "Leadership and floor view",
  worker_vs_worker: "Two accounts disagree",
  perception_gap: "Belief and lived reality",
};

function toolName(tool: CompanyReportStep["tool"]): string | null {
  if (!tool) return null;
  if (typeof tool === "string") return tool;
  return tool.name ?? tool.kind ?? null;
}

// Honest qualifier for a finding whose record never reached CONFIRMED (pilot §3, leak 2).
// A hand-added record is capped CLAIMED; it must never read as an unlabeled finding.
function unverifiedLabel(tag: string | null): string {
  switch (tag) {
    case "SCRAPED":
      return "From public sources";
    case "GUESS":
      return "Unconfirmed estimate";
    case "CLAIMED":
      return "Claimed — not yet verified";
    default:
      return "Unverified";
  }
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-12 flex items-baseline gap-3 border-b border-line pb-2 font-display text-2xl text-ink">
      <span className="text-sm font-semibold tabular text-ink-faint">{String(n).padStart(2, "0")}</span>
      {children}
    </h2>
  );
}

export default async function CompanyReportPage({ params }: { params: { token: string } }) {
  let report: CompanyReport;
  try {
    report = await get_company_report(params.token);
  } catch {
    notFound();
  }

  const learned = report.snapshot.filter((c) => c.card_type === "learned");
  const date = new Date(report.generated_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  let n = 0;

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <div className="mx-auto max-w-3xl px-8 py-12 print:py-4">
        {/* ── Client-branded header ── */}
        <header className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Company Report
            </div>
            <h1 className="mt-2 font-display text-[2.75rem] leading-[1.05] text-ink">
              {report.company.name}
            </h1>
            <div className="mt-2 text-sm text-ink-soft">
              {report.company.industry && <span className="capitalize">{report.company.industry} · </span>}
              {date}
              {report.stats.interviews > 0 && (
                <span> · built from {report.stats.interviews} interview{report.stats.interviews === 1 ? "" : "s"} and {report.stats.records} records</span>
              )}
            </div>
          </div>
          <PrintButton />
        </header>

        {report.snapshot.length === 0 && report.workflows.length === 0 ? (
          <p className="mt-12 rounded-card border border-line bg-surface p-6 text-sm leading-relaxed text-ink-soft">
            This report has no compiled findings yet. It fills in as interviews are
            completed and the company snapshot is built.
          </p>
        ) : (
          <>
            {/* ── What we learned ── */}
            {learned.length > 0 && (
              <section className="break-inside-avoid-page">
                <SectionTitle n={++n}>What we learned</SectionTitle>
                <div className="mt-4 space-y-4">
                  {learned.map((c) => {
                    const content = c.content as { title: string; body: string };
                    return (
                      <div key={c.id} className="break-inside-avoid">
                        <div className="font-medium text-ink">{content.title}</div>
                        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{content.body}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Key findings ── */}
            {report.key_findings.length > 0 && (
              <section>
                <SectionTitle n={++n}>Key findings</SectionTitle>
                <div className="mt-4 space-y-4">
                  {report.key_findings.map((f, i) => (
                    <div key={i} className="break-inside-avoid">
                      <div className="flex flex-wrap items-center gap-2">
                        {f.band && <PainBandChip band={f.band} />}
                        {f.mention_count > 1 && (
                          <span className="text-xs text-ink-faint">
                            raised {f.mention_count} times
                          </span>
                        )}
                        {f.role && <span className="text-xs text-ink-faint">from the {f.role}</span>}
                        {f.unverified && (
                          <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-faint">
                            {unverifiedLabel(f.tag)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">{f.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── How work flows today ── */}
            {report.workflows.length > 0 && (
              <section>
                <SectionTitle n={++n}>How work flows today</SectionTitle>
                <div className="mt-4 space-y-6">
                  {report.workflows.map((wf) => (
                    <div key={wf.name} className="break-inside-avoid">
                      <div className="font-medium text-ink">{wf.name}</div>
                      {wf.unverified && (
                        <div className="mt-0.5 text-xs text-ink-faint">
                          Provisional — built from unverified records.
                        </div>
                      )}
                      <ol className="mt-2 space-y-1.5">
                        {wf.steps.map((s) => {
                          const tool = toolName(s.tool);
                          return (
                            <li key={s.index} className="flex gap-3 text-sm leading-relaxed">
                              <span className="w-5 shrink-0 text-right tabular text-ink-faint">{s.index + 1}.</span>
                              <span className="text-ink">
                                {s.title ?? s.action}
                                {tool && tool !== "unknown" && (
                                  <span className="text-ink-faint"> · {tool}</span>
                                )}
                                {s.status === "needs_clarification" && (
                                  <span className="text-ink-faint"> (still to confirm)</span>
                                )}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── What does not line up ── */}
            {report.gaps.length > 0 && (
              <section>
                <SectionTitle n={++n}>What does not line up</SectionTitle>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                  Different people described the same work differently. These gaps are
                  usually where the biggest improvements hide.
                </p>
                <div className="mt-4 space-y-4">
                  {report.gaps.map((g, i) => (
                    <div key={i} className="break-inside-avoid rounded-card border border-line bg-surface p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
                        {GAP_LABEL[g.kind] ?? "Conflicting accounts"}
                        {g.status === "resolved" && " · resolved"}
                      </div>
                      {g.note && <p className="mt-1.5 text-sm leading-relaxed text-ink">{g.note}</p>}
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[g.a, g.b].map((side, j) => (
                          <div key={j} className="rounded-lg bg-surface-sunken/60 p-3">
                            <div className="text-xs text-ink-faint">{side.role ? `The ${side.role}` : "One account"}</div>
                            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{side.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Automation opportunities ── */}
            {report.opportunities.length > 0 && (
              <section>
                <SectionTitle n={++n}>Automation opportunities</SectionTitle>
                <div className="mt-4 space-y-4">
                  {report.opportunities.map((o, i) => (
                    <div key={i} className="break-inside-avoid">
                      <div className="font-medium text-ink">{o.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{o.summary}</p>
                      {o.roi && (
                        <div className="mt-2 rounded-lg border border-dashed border-line px-3 py-2 text-xs leading-relaxed text-ink-soft">
                          <span className="font-semibold text-ink">Estimate, not a measurement.</span>{" "}
                          {o.roi.assumption}
                          {o.roi.low_hours_month != null && o.roi.high_hours_month != null && (
                            <span>
                              {" "}Rough size: {o.roi.low_hours_month} to {o.roi.high_hours_month} hours a month.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Next steps ── */}
            {report.next_steps.length > 0 && (
              <section>
                <SectionTitle n={++n}>Next steps</SectionTitle>
                <ol className="mt-4 space-y-2.5">
                  {report.next_steps.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-5 shrink-0 text-right tabular text-ink-faint">{i + 1}.</span>
                      <span className="text-ink">
                        {s.kind === "investigate" && <span className="text-ink-faint">Investigate: </span>}
                        {s.kind === "follow_up" && <span className="text-ink-faint">Follow up: </span>}
                        {s.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}

        {/* ── Quiet product footer ── */}
        <footer className="mt-16 border-t border-line pt-4 text-xs text-ink-faint">
          Powered by {brand.product_name} · Findings are compiled from interviews and each
          carries its own confidence level; anything not yet verified across interviews is
          labelled as such.
        </footer>
      </div>
    </div>
  );
}
