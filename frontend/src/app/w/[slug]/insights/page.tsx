import { redirect } from "next/navigation";

// Insights FOLDED into Home (ADD-3.3, Kaan-confirmed). Cross-interview intelligence —
// perception gaps, key findings, automation opportunities — now lives on the Company
// Snapshot (Home), its one canonical surface; admissions/open questions live in Company
// Context + Home's attention list. This route survives only as a redirect so old links,
// bookmarks, and any lingering deep-links land on Home instead of a 404.
export default function InsightsPage({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/home`);
}
