import { redirect } from "next/navigation";

// A bare /w/[slug] has no screen of its own (Overview was removed), so send it to the
// Company Snapshot — the workspace landing — instead of dead-ending on a 404 (#31).
export default async function WorkspaceIndex(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  redirect(`/w/${params.slug}/home`);
}
