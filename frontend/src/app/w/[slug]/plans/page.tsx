import { redirect } from "next/navigation";

// The interview-plans list is now the first stage of the unified Interviews hub
// (Feedback-K / audit finding 2: /interviews and /plans listed the same people twice).
// This route redirects to the hub, carrying the ?new=1 "create" intent. Plan DETAIL pages
// (/plans/[id]) are unchanged and keep working as deep links.
export default function PlansPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { new?: string };
}) {
  const suffix = searchParams?.new === "1" ? "?new=1" : "";
  redirect(`/w/${params.slug}/interviews${suffix}`);
}
