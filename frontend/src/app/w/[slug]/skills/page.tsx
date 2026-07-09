import { redirect } from "next/navigation";

// Agent Skills folded into Workflows (Kaan-approved UI-debate proposal 2, July 9).
// A blueprint IS a workflow's export artifact, not a separate noun: the Skill
// Blueprint / Generate SOP actions already live on the workflow view, and this page
// only pointed there. Old links and bookmarks land on Workflows instead of a 404.
// If runnable skills ship later, this route can grow back into a real page.
export default function AgentSkillsRedirect({ params }: { params: { slug: string } }) {
  redirect(`/w/${params.slug}/workflows`);
}
