import { notFound } from "next/navigation";
import { get_workspace } from "@/lib/live";
import { AppShell } from "@/components";

// Workspace layout (#31). The shell (left nav + top bar + user block) lives here, not in
// each page, so it renders once and PERSISTS across soft navigations between screens —
// no nav re-mount, no flash, and a page's loading.tsx only fills the content slot. The
// active nav item is derived from the pathname inside AppShell. Pages under this layout
// return bare content.
export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const workspace = await get_workspace(params.slug);
  if (!workspace) notFound();

  return <AppShell workspace={workspace}>{children}</AppShell>;
}
