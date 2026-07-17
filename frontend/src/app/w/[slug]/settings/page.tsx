import { notFound } from "next/navigation";
import { get_workspace, get_voice_config } from "@/lib/live-server";
import { VoiceSettings } from "@/components";
import { PulseSettings } from "@/components/PulseSettings";

// Workspace settings (Sprint-2 Lane B / #39). Server-fetches the workspace + its current
// voice config (admin token via lib/live-server), then hands the editor its initial state.
// Uncustomized workspaces resolve to the shared default, so this always renders.
// F3: the Weekly Pulse toggle sits below the voice section (off by default).
export const dynamic = "force-dynamic";

export default async function SettingsPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();
  const voice = await get_voice_config(workspace.id);
  const pulseEnabled = Boolean((workspace.config ?? {}).weekly_pulse);
  return (
    <>
      <VoiceSettings workspaceId={workspace.id} initial={voice} />
      <PulseSettings workspaceId={workspace.id} initialEnabled={pulseEnabled} />
    </>
  );
}
