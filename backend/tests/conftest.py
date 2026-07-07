"""Test harness — runs against a LOCAL throwaway Postgres+pgvector, never a real
tenant (A12: fixtures never touch a real workspace). The DSN is overridden before
app modules read settings; each test gets a freshly-migrated schema."""

import os
from pathlib import Path

import pytest

# Point the app at the local test container BEFORE settings are cached.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:nexus@localhost:55432/nexus_test"
)
os.environ["OPENAI_API_KEY"] = ""  # keep embeddings offline in tests

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.db import get_pool  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]
MIGRATIONS = [
    BACKEND / "db" / "migrations" / "0001_foundation.sql",
    BACKEND / "db" / "migrations" / "0002_ontology_ops.sql",
    BACKEND / "db" / "migrations" / "0003_client_view_columns.sql",
    BACKEND / "db" / "migrations" / "0004_phase6.sql",
    BACKEND / "db" / "migrations" / "0005_chat_context.sql",
    BACKEND / "db" / "migrations" / "0006_workflow_overlays.sql",
    BACKEND / "db" / "migrations" / "0007_internal_flags.sql",
    BACKEND / "db" / "migrations" / "0008_coverage_tracker.sql",
    BACKEND / "db" / "migrations" / "0009_voice_config.sql",
    BACKEND / "db" / "migrations" / "0010_observer_insights.sql",
    BACKEND / "db" / "migrations" / "0011_sealed_flags.sql",
    BACKEND / "db" / "migrations" / "0012_yield_stats.sql",
]


@pytest.fixture(autouse=True)
def _admin_auth_bypass():
    """Admin routes now require a verified Supabase JWT (app/auth.require_admin). Tests
    drive the ASGI app in-process with no GoTrue, so we override the dependency to a
    fixed test admin — the FastAPI-blessed way to exercise gated routes without a live
    auth provider. test_auth.py pops this override to exercise the real gate."""
    from app.auth import require_admin
    from app.main import app

    app.dependency_overrides[require_admin] = lambda: "test-admin"
    yield
    app.dependency_overrides.pop(require_admin, None)


@pytest.fixture
async def db():
    # pytest-asyncio gives each test its own event loop; the module-global asyncpg
    # pool must be rebound to the current loop or asyncpg raises "loop is closed".
    import app.db as dbmod

    if dbmod._pool is not None:
        await dbmod._pool.close()
        dbmod._pool = None

    pool = await get_pool()
    await pool.execute("drop schema public cascade; create schema public;")
    for m in MIGRATIONS:
        await pool.execute(m.read_text())
    yield pool
    await pool.close()
    dbmod._pool = None


async def make_workspace(pool, *, is_demo=False, industry=None):
    return await pool.fetchval(
        "insert into workspaces (name, slug, industry, is_demo) "
        "values ($1, $2, $3, $4) returning id",
        "Test Co",
        f"test-{os.urandom(4).hex()}",
        industry,
        is_demo,
    )


async def make_session(pool, workspace_id, *, interviewee_id=None):
    return await pool.fetchval(
        "insert into interview_sessions (workspace_id, interviewee_id) "
        "values ($1, $2) returning id",
        workspace_id,
        interviewee_id,
    )
