"""P0-1 admin gate: every admin /api route requires a verified Supabase JWT; the
interviewee by-token routes stay public. These tests pop the conftest bypass so they
exercise the real require_admin dependency, stubbing only the GoTrue network call."""

from httpx import ASGITransport, AsyncClient

from app import auth
from app.main import app


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


def _use_real_gate():
    # Drop the conftest autouse override so require_admin actually runs.
    app.dependency_overrides.pop(auth.require_admin, None)
    auth._CACHE.clear()


async def test_admin_route_401_without_bearer(db):
    _use_real_gate()
    async with _client() as c:
        r = await c.get("/api/workspaces")
    assert r.status_code == 401


async def test_admin_route_401_with_malformed_header(db):
    _use_real_gate()
    async with _client() as c:
        r = await c.get("/api/workspaces", headers={"Authorization": "token abc"})
    assert r.status_code == 401


async def test_admin_route_ok_with_verified_bearer(db, monkeypatch):
    _use_real_gate()

    async def fake_verify(token: str) -> str:
        assert token == "good-jwt"
        return "user-123"

    monkeypatch.setattr(auth, "_verify_with_gotrue", fake_verify)
    async with _client() as c:
        r = await c.get("/api/workspaces", headers={"Authorization": "Bearer good-jwt"})
    assert r.status_code == 200


async def test_interview_token_route_is_public(db):
    # A bad token reaches the handler and 404s — proving the route is NOT auth-gated
    # (an auth-gated route would 401 first, before the token lookup).
    _use_real_gate()
    async with _client() as c:
        r = await c.get("/api/sessions/by-token/does-not-exist")
    assert r.status_code == 404
