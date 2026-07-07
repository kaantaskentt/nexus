"""Admin auth for the eval harness — a REAL Supabase (GoTrue) password grant, never a
bypass. The harness drives admin-gated routes (eval-bootstrap, plans/send), so it must
hold a genuine session exactly like the browser does; the backend verifies the token the
same way for both. This is the honest path the P0-1 gate demands — no localhost allow-list.

Credentials come from the environment (never committed):
    NEXUS_ADMIN_EMAIL, NEXUS_ADMIN_PASSWORD   — the admin login (see backend create_admin.py)
    SUPABASE_URL, SUPABASE_ANON_KEY           — same values the app uses (loaded from repo .env)

Run against a local stack the same way: point the harness at it and set EVAL_MODE=1 on the
server; the harness still authenticates for real.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TOKEN: str | None = None


def _load_repo_env() -> None:
    """Mirror the backend: hydrate os.environ from the repo-root .env if present, without
    overriding anything already exported. Keeps the harness turnkey with the same config."""
    env = _REPO_ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


async def admin_bearer() -> str:
    """Return an access token for the admin, logging in once and caching it for the run."""
    global _TOKEN
    if _TOKEN:
        return _TOKEN

    _load_repo_env()
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    anon = os.environ.get("SUPABASE_ANON_KEY", "")
    email = os.environ.get("NEXUS_ADMIN_EMAIL", "")
    password = os.environ.get("NEXUS_ADMIN_PASSWORD", "")
    if not (url and anon and email and password):
        raise RuntimeError(
            "harness admin auth needs SUPABASE_URL, SUPABASE_ANON_KEY, NEXUS_ADMIN_EMAIL "
            "and NEXUS_ADMIN_PASSWORD in the environment (repo .env or exported)"
        )

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{url}/auth/v1/token?grant_type=password",
            headers={"apikey": anon, "Content-Type": "application/json"},
            json={"email": email, "password": password},
        )
    resp.raise_for_status()
    _TOKEN = resp.json()["access_token"]
    return _TOKEN


async def admin_headers() -> dict[str, str]:
    """Authorization header for an admin-gated call."""
    return {"Authorization": f"Bearer {await admin_bearer()}"}
