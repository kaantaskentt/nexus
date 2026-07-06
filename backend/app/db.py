"""asyncpg pool. All client-facing claim queries MUST go through the
client_visible_claims view — never the claim_records base table (non-negotiable #4)."""

import asyncpg

from .config import get_settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = get_settings().database_url
        # Supabase's transaction pooler (pgbouncer, port 6543) does not persist prepared
        # statements across checkouts; asyncpg's implicit statement cache then throws
        # "prepared statement already exists". Disable the cache only for the pooler —
        # local direct connections keep it for speed.
        pooled = "pooler.supabase.com" in dsn or ":6543" in dsn
        _pool = await asyncpg.create_pool(
            dsn, min_size=1, max_size=10,
            statement_cache_size=0 if pooled else 100,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
