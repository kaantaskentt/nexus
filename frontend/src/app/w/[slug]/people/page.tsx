import { notFound } from "next/navigation";
import { get_workspace, list_people, list_seats } from "@/lib/live-server";
import { PeopleDirectory } from "@/components/people/PeopleDirectory";

// People roster + workspace seat grant (client login). Interview invites stay on
// Interviews / Home — this page manages who can sign into the workspace.
export const dynamic = "force-dynamic";

export default async function PeoplePage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  const [people, seats] = await Promise.all([
    list_people(workspace.id).catch(() => []),
    list_seats(workspace.id).catch(() => []),
  ]);
  return (
    <PeopleDirectory
      workspace={workspace}
      initialPeople={people}
      initialSeats={seats}
    />
  );
}
