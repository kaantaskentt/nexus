import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { list_incidents } from "@/lib/live-server";
import { IncidentInbox } from "@/components/IncidentInbox";

// R6 — Section-7 harm-incident inbox (Kaan ruling). A reviewer-scoped Nexus-team surface:
// admin-gated by the backend (require_admin on /api/incidents), and it shows only the
// minimized incident rows — there is no verbatim disclosure content anywhere in this path.
// This replaces the SendGrid email as the notification channel (email dropped from R6).
export default async function IncidentsPage() {
  const incidents = await list_incidents();
  const open = incidents.filter((i) => i.review_status === "unreviewed").length;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex h-16 items-center gap-3 px-8">
        <Link href="/" className="text-ink-soft hover:text-ink" aria-label="Back to workspaces">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">
        <h1 className="font-display text-3xl text-ink">Disclosure incidents</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Section-7 disclosures flagged during interviews, quarantined at the data layer. These
          records hold no verbatim content by design; each is a signal for a human reviewer to
          act on in the sealed-flag ops layer. {open > 0 ? `${open} awaiting review.` : "All handled."}
        </p>
        <IncidentInbox initial={incidents} />
      </main>
    </div>
  );
}
