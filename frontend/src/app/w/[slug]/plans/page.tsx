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
  // The "create" intent now lands on the assign flow; the bare list folds into the hub.
  redirect(
    searchParams?.new === "1"
      ? `/w/${params.slug}/interviews/new`
      : `/w/${params.slug}/interviews`,
  );
}
