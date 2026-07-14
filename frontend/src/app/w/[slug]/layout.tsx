import { notFound } from "next/navigation";
import { get_me, list_workspaces } from "@/lib/live-server";
import { signedInUser } from "@/lib/server-user";
import { AppShell } from "@/components";

// Workspace layout (#31). The shell (left nav + top bar + user block) lives here, not in
// each page, so it renders once and PERSISTS across soft navigations between screens —
// no nav re-mount, no flash, and a page's loading.tsx only fills the content slot. The
// active nav item is derived from the pathname inside AppShell. Pages under this layout
// return bare content.
//
// EMRE sprint: the shell receives the REAL signed-in user (target 1 — Emre sees Emre,
// never the workspace founder) and the full workspace list for the switcher (target 3).
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  // F6: always resolve the seat so a granted client gets the cut-down shell
  // (Simulations / Settings hidden). No row ⇒ admin.
  const [workspaces, user, seat] = await Promise.all([
    list_workspaces().catch(() => []),
    signedInUser(),
    get_me().catch(() => null),
  ]);
  const workspace = workspaces.find((w) => w.slug === params.slug);
  if (!workspace) notFound();

  return (
    <AppShell
      workspace={workspace}
      workspaces={workspaces}
      user={user}
      role={seat?.role ?? "admin"}
    >
      {children}
    </AppShell>
  );
}
