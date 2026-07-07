"""asyncpg pool. All client-facing claim queries MUST go through the
client_visible_claims view — never the claim_records base table (non-negotiable #4)."""

import json

import asyncpg

from .config import get_settings

_pool: asyncpg.Pool | None = None


def _jsonb_encode(value):
    # asyncpg calls this to serialize a Python value bound to a jsonb column (never for
    # None — that maps straight to SQL NULL). The write side historically json.dumps()es
    # its own payloads and binds the resulting text, so pass an already-serialized JSON
    # string through unchanged (identical wire behaviour to before the codec) and only
    # dump genuine Python objects. This keeps the encode contract tolerant of both the
    # legacy string convention and new object-passing callers.
    return value if isinstance(value, str) else json.dumps(value)


async def _init_conn(conn: asyncpg.Connection) -> None:
    # Decode jsonb columns to Python objects on read so callers stop hand-decoding with
    # scattered `json.loads(v) if isinstance(v, str) else v` shims. Paired tolerant
    # encoder above keeps existing writes correct.
    await conn.set_type_codec(
        "jsonb", encoder=_jsonb_encode, decoder=json.loads, schema="pg_catalog"
    )


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
            init=_init_conn,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
