import { redirect } from "next/navigation";

// The interview-plans list is now the first stage of the unified Interviews hub
// (Feedback-K / audit finding 2: /interviews and /plans listed the same people twice).
// This route redirects to the hub, carrying the ?new=1 "create" intent. Plan DETAIL pages
// (/plans/[id]) are unchanged and keep working as deep links.
export default async function PlansPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ new?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // The "create" intent now lands on the assign flow; the bare list folds into the hub.
  redirect(
    searchParams?.new === "1"
      ? `/w/${params.slug}/interviews/new`
      : `/w/${params.slug}/interviews`,
  );
}
