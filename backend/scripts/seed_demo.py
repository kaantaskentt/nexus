"""Seed the Bee Goddess demo workspace.

A12 firewall: this workspace is is_demo=true and every record in it is FICTION
(Ece / Burak / Selin do not exist). The script refuses to run against a workspace
that isn't flagged demo, so fixtures can never leak into a real tenant.

Usage:
    python -m scripts.seed_demo            # structural seed + compile the transcript
    python -m scripts.seed_demo --no-compile

Runs against whatever DATABASE_URL points at. For the live Supabase (which isn't
reachable via local asyncpg here) the same dataset is ported via the Supabase MCP.
"""

import argparse
import asyncio

from app.db import close_pool, get_pool
from app.pipeline import compiler

SLUG = "bee-goddess-demo"

# Fictional Stage-1 people pool (source='fixture'). Burak is pre-known so the
# compiler MATCHES him; Selin is absent so the compiler DISCOVERS her (NEW-PERSON).
FIXTURE_PEOPLE = [
    ("Ece", "person", "Founder", "Executive"),
    ("Burak", "person", "Operations", "Operations"),
]

TRANSCRIPT = [
    ("agent", "Thanks for making time. Walk me through how repricing works each morning?"),
    ("respondent", "Every morning Burak handles the repricing. He keeps his own Excel, has for years."),
    ("respondent", "It takes him, sanırım, maybe two hours? Something like that."),
    ("agent", "And how does that Excel get updated?"),
    ("respondent", "Honestly I don't know the details — Burak just does it. Between us he's a bit slow with these things, good man though."),
    ("agent", "How many boutiques are you running now?"),
    ("respondent", "Twelve boutiques. Well — actually ten now, we closed Ankara last month."),
    ("respondent", "One thing: don't mention anything to the Harrods people, we're renegotiating."),
    ("agent", "Understood. What does a good day look like for online orders?"),
    ("respondent", "When we ship every yıldırım order same-day, that's a win. We follow up within 24 hours."),
    ("respondent", "Selin handles all the online returns — she'd know that side better than me."),
]


async def _wipe_workspace(pool, ws) -> None:
    """Delete all rows for one workspace in FK-dependency order (children first)."""
    await pool.execute(
        "delete from pain_scores where claim_id in "
        "(select id from claim_records where workspace_id = $1)", ws)
    await pool.execute("delete from claim_conflicts where workspace_id = $1", ws)
    await pool.execute("delete from claim_records where workspace_id = $1", ws)
    await pool.execute("delete from agent_runs where workspace_id = $1", ws)
    await pool.execute(
        "delete from utterances where session_id in "
        "(select id from interview_sessions where workspace_id = $1)", ws)
    await pool.execute(
        "delete from handoff_packages where plan_id in "
        "(select id from interview_plans where workspace_id = $1)", ws)
    await pool.execute(
        "delete from plan_state_transitions where plan_id in "
        "(select id from interview_plans where workspace_id = $1)", ws)
    await pool.execute(
        "delete from workflow_steps where workflow_id in "
        "(select id from workflows where workspace_id = $1)", ws)
    await pool.execute("delete from workflows where workspace_id = $1", ws)
    await pool.execute("delete from interview_sessions where workspace_id = $1", ws)
    await pool.execute("delete from interview_plans where workspace_id = $1", ws)
    await pool.execute("delete from interview_rounds where workspace_id = $1", ws)
    await pool.execute("delete from heuristics where workspace_id = $1", ws)
    await pool.execute("delete from scrape_sources where workspace_id = $1", ws)
    await pool.execute("delete from snapshot_cards where workspace_id = $1", ws)
    await pool.execute("delete from entities where workspace_id = $1", ws)
    await pool.execute("delete from workspaces where id = $1", ws)


async def seed(compile_transcript: bool = True) -> str:
    pool = await get_pool()

    existing = await pool.fetchrow("select id, is_demo from workspaces where slug = $1", SLUG)
    if existing and not existing["is_demo"]:
        raise SystemExit(f"REFUSING: workspace {SLUG!r} exists and is_demo=false (A12 firewall)")
    if existing:
        # Idempotent reseed: wipe this demo tenant's rows in FK-dependency order.
        ws = existing["id"]
        await _wipe_workspace(pool, ws)

    ws = await pool.fetchval(
        "insert into workspaces (name, slug, industry, is_demo) "
        "values ('Bee Goddess', $1, 'jewelry', true) returning id",
        SLUG,
    )

    people = {}
    for name, etype, role, dept in FIXTURE_PEOPLE:
        people[name] = await pool.fetchval(
            "insert into entities (workspace_id, entity_type, canonical_name, role, "
            "department, is_vendor_side, source) values ($1,$2,$3,$4,$5,false,'fixture') returning id",
            ws, etype, name, role, dept,
        )

    round_id = await pool.fetchval(
        "insert into interview_rounds (workspace_id, label, status, completed_at) "
        "values ($1, 'Founder round', 'completed', now()) returning id",
        ws,
    )
    session_id = await pool.fetchval(
        "insert into interview_sessions (workspace_id, round_id, interviewee_id, "
        "modality, status, language, ended_at) values ($1,$2,$3,'text','completed','en',now()) "
        "returning id",
        ws, round_id, people["Ece"],
    )
    for i, (spk, txt) in enumerate(TRANSCRIPT):
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,$3,$4)",
            session_id, i, spk, txt,
        )

    if compile_transcript:
        await compiler.compile_session({"session_id": str(session_id)})

    n_claims = await pool.fetchval("select count(*) from claim_records where workspace_id=$1", ws)
    n_ent = await pool.fetchval("select count(*) from entities where workspace_id=$1", ws)
    print(f"Seeded {SLUG}: workspace={ws} entities={n_ent} claim_records={n_claims}")
    return str(ws)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-compile", action="store_true")
    args = ap.parse_args()
    try:
        await seed(compile_transcript=not args.no_compile)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
