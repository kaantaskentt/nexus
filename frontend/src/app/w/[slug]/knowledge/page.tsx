import { redirect } from "next/navigation";

// A21 IA rename: Knowledge Base is now Company Context. Old links keep working.
export default async function KnowledgeRedirect(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  redirect(`/w/${params.slug}/context`);
}
