import { notFound } from "next/navigation";
import { get_workspace, get_voice_config } from "@/lib/live-server";
import { VoiceSettings } from "@/components";

// Workspace settings (Sprint-2 Lane B / #39). Server-fetches the workspace + its current
// voice config (admin token via lib/live-server), then hands the editor its initial state.
// Uncustomized workspaces resolve to the shared default, so this always renders.
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const voice = await get_voice_config(workspace.id);
  return <VoiceSettings workspaceId={workspace.id} initial={voice} />;
}
