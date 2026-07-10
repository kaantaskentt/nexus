import "server-only";
// Server Components' data layer (P0-1). Same functions as lib/live.ts, but each reads the
// admin token from the request's Supabase cookie and passes it through, so backend
// admin routes admit the SSR fetch. Client Components keep importing lib/live.ts directly
// (browser token). Signatures match live.ts exactly — a server page only swaps its import.
import { cache } from "react";
import * as live from "./live";
import { serverAccessToken } from "./server-token";
import type { NewCompany } from "./live";

export type { NewCompany };

async function tok(): Promise<string | null> {
  return serverAccessToken();
}

// ONE workspace-list fetch per request (Emre report #7 — perceived slowness): the
// layout, get_workspace, and any page share the same promise. api.ts is no-store
// (deliberate, #13), which also disables Next's fetch dedupe — React cache() restores
// dedupe within a single request without reintroducing cross-request staleness.
const requestWorkspaces = cache(async () =>
  live.list_workspaces((await tok()) ?? undefined),
);

export const list_workspaces = async () => requestWorkspaces();
export const get_workspace = async (slug: string) =>
  (await requestWorkspaces()).find((w) => w.slug === slug);
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
export const get_automation = async (workspace_id: string) =>
  live.get_automation(workspace_id, (await tok()) ?? undefined);
export const get_insights = async (workspace_id: string) =>
  live.get_insights(workspace_id, (await tok()) ?? undefined);
export const list_sessions = async (workspace_id: string) =>
  live.list_sessions(workspace_id, (await tok()) ?? undefined);
export const get_voice_config = async (workspace_id: string) =>
  live.get_voice_config(workspace_id, (await tok()) ?? undefined);
export const get_effective_workflow = async (workflow_id: string) =>
  live.get_effective_workflow(workflow_id, (await tok()) ?? undefined);
export const get_report = async (
  session_id: string,
  meta?: { interviewee_name?: string; interviewee_role?: string },
) => live.get_report(session_id, meta, (await tok()) ?? undefined);
export const observe_session = async (workspace_id: string, session_id: string) =>
  live.observe_session(workspace_id, session_id, (await tok()) ?? undefined);
export const list_simulations = async (workspace_id: string) =>
  live.list_simulations(workspace_id, (await tok()) ?? undefined);
export const get_simulation_history = async () =>
  live.get_simulation_history((await tok()) ?? undefined);
export const get_workflows = async (workspace_id: string) =>
  live.get_workflows(workspace_id, (await tok()) ?? undefined);

// Client-safe helpers re-exported so server pages that only need these don't reach for
// lib/live (keeps every server page on a single import).
export { reportIsCompiling } from "./live";
export type { SessionSummary, SendResult, DiscoveryStart, WorkflowSummary, VoiceConfig, VoiceOption, ObserverState } from "./live";
export const get_weekly_pulse = async (workspace_id: string) =>
  live.get_weekly_pulse(workspace_id, (await tok()) ?? undefined);
export const get_me = async () => live.get_me((await tok()) ?? undefined);
export const list_roleplay = async (workspace_id: string) =>
  live.list_roleplay(workspace_id, (await tok()) ?? undefined);
export const get_scenarios = async (workspace_id: string) =>
  live.get_scenarios(workspace_id, (await tok()) ?? undefined);
