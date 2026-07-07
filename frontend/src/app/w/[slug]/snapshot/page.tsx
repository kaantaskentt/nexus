import { redirect } from "next/navigation";

// A21 IA rename: the Company Snapshot is now Home. Old links keep working.
export default function SnapshotRedirect({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/home`);
}
