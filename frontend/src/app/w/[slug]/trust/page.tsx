import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  EyeOff,
  Lock,
  FlaskConical,
  Database,
  UserCheck,
} from "lucide-react";
import { get_workspace } from "@/lib/live-server";
import brand from "@/lib/brand";

// F5 Trust Center (marathon, July 8): ONE page assembling truths that already hold
// elsewhere in the system. Content-only by design: nothing here reads or writes system
// state, so this page can never drift from enforcing anything — it only describes what
// the data layer enforces. Sources: prompts/personas/consent-landing.md (promise),
// 0011_sealed_flags.sql (sealed flags), non-negotiables 1-6 (CLAUDE.md / MERGE_PLAN).
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    icon: UserCheck,
    title: "The promise we make to your people",
    body: [
      "Every interview starts with a consent page and an explicit start action. Nothing begins passively.",
      "Nothing is quoted with a person's name on it. Findings are shared by role, like \"someone in operations\", and answers are combined with everyone else's before anyone sees conclusions.",
      "If someone wants credit for an idea, they can say so, and they see exactly how it appears before it goes anywhere. Naming starts with the respondent, never with us.",
      "No one is asked to rate a colleague, and an interview is never a performance review.",
    ],
  },
  {
    icon: EyeOff,
    title: "Sentiment about people is quarantined",
    body: [
      "If an opinion about a named person comes up in a conversation, it is kept out of everything a client sees: snapshots, insights, reports and exports all read from a view that excludes it.",
      "This is enforced at the data layer, not by asking the interviewer nicely. A quarantined record cannot appear on a client surface because the surface cannot read it.",
    ],
  },
  {
    icon: Lock,
    title: "Serious disclosures are sealed",
    body: [
      "If an interview surfaces a serious allegation (harassment, discrimination, safety, illegality), it is recorded as a sealed flag that lives outside the record store entirely.",
      "No client-facing screen serves sealed flags, and no compile, snapshot or report path reads them. Whether anything reaches the company is a case-by-case human decision under the services agreement.",
    ],
  },
  {
    icon: FlaskConical,
    title: "We test the interviewer before your people meet it",
    body: [
      "The interviewer is pressure-tested against simulated employees who hold back facts and drop misleading cues on purpose. The scored rounds are published on the Simulations page as a standing record.",
      "Simulated runs are firewalled from real company data: nothing said in a test enters your company context.",
    ],
  },
  {
    icon: Database,
    title: "Data boundaries",
    body: [
      "Transcripts are stored as spoken, word for word. Hesitations are data; we do not clean them up.",
      "Records are never edited after the fact, and a record's confidence level never silently upgrades. Truth emerges from comparing accounts, not from rewriting them.",
      "Public web information is reference material only, weighted lightly and never treated as verified. What people actually said is the product.",
      "Demo and example content is structurally separated from real client workspaces.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "A human approves every contact",
    body: [
      "Nothing contacts your employees without explicit approval from you. Interview plans wait at an approval gate, and you see every question before it is sent.",
      "What you told us privately shapes what we ask, never what we say. Nothing you shared is repeated to an interviewee.",
    ],
  },
];

export default async function TrustPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink">Trust Center</h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink-soft">
        How {brand.product_name} handles what your people tell it. Everything on this
        page describes rules that are enforced in the system itself, not policies we
        promise to remember.
      </p>

      <div className="mt-8 space-y-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section
              key={s.title}
              className="card-hairline rounded-card border border-line bg-surface p-5"
            >
              <h2 className="flex items-center gap-2.5 font-medium text-ink">
                <Icon className="h-[18px] w-[18px] text-accent" strokeWidth={1.75} />
                {s.title}
              </h2>
              <div className="mt-2.5 space-y-2">
                {s.body.map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink-soft">
                    {line}
                  </p>
                ))}
              </div>
              {s.icon === FlaskConical && (
                <Link
                  href={`/w/${workspace.slug}/simulations`}
                  className="mt-3 inline-block text-sm font-medium text-accent-ink underline-offset-2 hover:underline"
                >
                  See the proving record
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">
        Questions about any of this? Ask the {brand.product_name} team. The consent page
        your people see before an interview restates these promises in their language.
      </p>
    </div>
  );
}
