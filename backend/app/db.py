"""asyncpg pool. All client-facing claim queries MUST go through the
client_visible_claims view — never the claim_records base table (non-negotiable #4)."""

import json
from urllib.parse import urlsplit

import asyncpg

from .config import get_settings

_pool: asyncpg.Pool | None = None


def _uses_transaction_pooler(dsn: str) -> bool:
    """Detect the transaction pooler from parsed connection components only."""
    parsed = urlsplit(dsn)
    hostname = parsed.hostname or ""
    return (
        parsed.port == 6543
        or hostname == "pooler.supabase.com"
        or hostname.endswith(".pooler.supabase.com")
    )


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


def loads(v, default=None):
    """Read-side jsonb helper, shared by the routers/pipeline (replaces the per-module
    `_loads` copies). The pool codec above already decodes jsonb to Python objects, so this
    is now mostly a null-to-default shim: return `default` when the column was SQL NULL,
    still decode the legacy case where a raw JSON string slips through, and otherwise pass
    the value straight through. 1-arg calls get default=None (identical to the old 1-arg
    `_loads`); 2-arg calls get their supplied default."""
    return json.loads(v) if isinstance(v, str) else (v if v is not None else default)


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = get_settings().database_url
        # Supabase's transaction pooler (pgbouncer, port 6543) does not persist prepared
        # statements across checkouts; asyncpg's implicit statement cache then throws
        # "prepared statement already exists". Disable the cache only for the pooler —
        # local direct connections keep it for speed.
        pooled = _uses_transaction_pooler(dsn)
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
