import "server-only";
// Server Components' data layer (P0-1). Same functions as lib/live.ts, but each reads the
// admin token from the request's Supabase cookie and passes it through, so backend
// admin routes admit the SSR fetch. Client Components keep importing lib/live.ts directly
// (browser token). Signatures match live.ts exactly — a server page only swaps its import.
import * as live from "./live";
import { serverAccessToken } from "./server-token";
import type { NewCompany } from "./live";

export type { NewCompany };

async function tok(): Promise<string | null> {
  return serverAccessToken();
}

export const list_workspaces = async () => live.list_workspaces((await tok()) ?? undefined);
export const get_workspace = async (slug: string) =>
  live.get_workspace(slug, (await tok()) ?? undefined);
export const list_plans = async (workspace_id: string) =>
  live.list_plans(workspace_id, (await tok()) ?? undefined);
export const get_plan = async (workspace_id: string, plan_id: string) =>
  live.get_plan(workspace_id, plan_id, (await tok()) ?? undefined);
export const list_snapshot_cards = async (workspace_id: string) =>
  live.list_snapshot_cards(workspace_id, (await tok()) ?? undefined);
export const list_claims = async (workspace_id: string, topic?: string) =>
  live.list_claims(workspace_id, topic, (await tok()) ?? undefined);
export const list_knowledge = async (workspace_id: string) =>
  live.list_knowledge(workspace_id, (await tok()) ?? undefined);
export const get_insights = async (workspace_id: string) =>
  live.get_insights(workspace_id, (await tok()) ?? undefined);
export const list_sessions = async (workspace_id: string) =>
  live.list_sessions(workspace_id, (await tok()) ?? undefined);
export const get_effective_workflow = async (workflow_id: string) =>
  live.get_effective_workflow(workflow_id, (await tok()) ?? undefined);
export const get_report = async (
  session_id: string,
  meta?: { interviewee_name?: string; interviewee_role?: string },
) => live.get_report(session_id, meta, (await tok()) ?? undefined);

// Client-safe helpers re-exported so server pages that only need these don't reach for
// lib/live (keeps every server page on a single import).
export { reportIsCompiling } from "./live";
export type { SessionSummary, SendResult, DiscoveryStart, WorkflowSummary } from "./live";
