"""Claim embeddings — best-effort. A missing/failing embedding API must never
block a compile: KB semantic search (Phase 0 #2) is a downstream enhancement, not
a precondition for the record store. Records insert with a null embedding when the
key is absent; a backfill job can fill them later."""

import openai

from .config import get_settings

_client: openai.AsyncOpenAI | None = None


def _openai() -> openai.AsyncOpenAI | None:
    global _client
    key = get_settings().openai_api_key
    if not key:
        return None
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=key)
    return _client


async def embed(text: str) -> list[float] | None:
    client = _openai()
    if client is None:
        return None
    try:
        resp = await client.embeddings.create(
            model=get_settings().openai_embedding_model, input=text[:8000]
        )
        return resp.data[0].embedding
    except Exception:
        return None


def to_pgvector(vec: list[float] | None) -> str | None:
    """asyncpg has no native pgvector codec here; store as the text form '[..]'."""
    if vec is None:
        return None
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"
