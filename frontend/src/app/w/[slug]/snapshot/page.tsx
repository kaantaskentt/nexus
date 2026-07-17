import { redirect } from "next/navigation";

// A21 IA rename: the Company Snapshot is now Home. Old links keep working.
export default async function SnapshotRedirect(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  redirect(`/w/${params.slug}/home`);
}
