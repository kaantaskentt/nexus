"""Media storage adapter — memory backend in CI; supabase missing key is hard-fail."""

import pytest

from app.config import get_settings
from app.media_storage import (
    MediaStorageError,
    clear_memory_store,
    delete_bytes,
    get_bytes,
    put_bytes,
    storage_path,
)


@pytest.fixture(autouse=True)
def _memory_backend(monkeypatch):
    clear_memory_store()
    monkeypatch.setenv("MEDIA_STORAGE_BACKEND", "memory")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
    clear_memory_store()


@pytest.mark.asyncio
async def test_put_get_roundtrip():
    path = storage_path("ws", "sess", "share", "doc.png")
    uri = await put_bytes(path, b"hello-bytes", "image/png")
    assert uri == path
    assert await get_bytes(path) == b"hello-bytes"


@pytest.mark.asyncio
async def test_delete_disabled():
    with pytest.raises(MediaStorageError, match="retained"):
        delete_bytes("any/path")


@pytest.mark.asyncio
async def test_supabase_missing_keys_fail(monkeypatch):
    monkeypatch.setenv("MEDIA_STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_URL", "")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "")
    get_settings.cache_clear()
    with pytest.raises(MediaStorageError, match="SUPABASE"):
        await put_bytes("a/b", b"x", "text/plain")
    get_settings.cache_clear()
