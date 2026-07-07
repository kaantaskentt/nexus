import { redirect } from "next/navigation";

// A21 IA rename: Knowledge Base is now Company Context. Old links keep working.
export default function KnowledgeRedirect({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/context`);
}
