import { redirect } from "next/navigation";

// A bare /w/[slug] has no screen of its own (Overview was removed), so send it to the
// Company Snapshot — the workspace landing — instead of dead-ending on a 404 (#31).
export default function WorkspaceIndex({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/home`);
}
