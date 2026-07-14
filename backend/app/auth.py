"""Admin auth — the gate for every admin API route (P0-1).

The only client credential is a real Supabase (GoTrue) session token: the browser
attaches it as `Authorization: Bearer <jwt>`, and we verify it by asking GoTrue who the
token belongs to (`GET {SUPABASE_URL}/auth/v1/user`). GoTrue verification is
signing-method-agnostic (works for both the legacy HS256 secret and asymmetric JWKS keys)
and needs no secret the backend doesn't already hold — only SUPABASE_URL + the anon key.

Deliberately NOT gated by this dependency (they carry their own gate):
  - the interviewee runtime routes (/api/sessions/by-token/*) — token-keyed by design;
  - the VAPI voice callbacks (/api/voice/*) — shared-secret gated.

Fail closed: a missing config or an unverifiable token is a 401/500, never an allow.
"""

import time

import httpx
from fastapi import Depends, Header, HTTPException, Request

from .config import get_settings

# token -> (user_id, expiry_monotonic). GoTrue verification is a network round-trip, so a
# short TTL collapses a burst of admin calls into one upstream check. A miss re-verifies —
# we never trust an unverified token, we just avoid re-asking about one we just confirmed.
_CACHE: dict[str, tuple[str, float]] = {}
_TTL_SECONDS = 60.0


async def _verify_with_gotrue(token: str) -> str:
    """Return the Supabase user id for a valid token, else raise 401. Config problems
    fail closed as 500 — an unconfigured auth layer must never silently allow callers."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(500, "admin auth is not configured (SUPABASE_URL / anon key)")
    url = settings.supabase_url.rstrip("/") + "/auth/v1/user"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "auth provider unreachable")
    if resp.status_code != 200:
        raise HTTPException(401, "invalid or expired session")
    return resp.json().get("id", "unknown")


async def require_admin(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: verify the caller's Supabase JWT, return their user id.

    Applied to every admin router in main.py. Order matters — a missing bearer is a 401
    before we ever touch config or the network, so unauthenticated callers are cheap to
    reject and the eval harness's public by-token path is never dragged through here."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "missing bearer token")

    now = time.monotonic()
    cached = _CACHE.get(token)
    if cached and cached[1] > now:
        return cached[0]

    user_id = await _verify_with_gotrue(token)
    _CACHE[token] = (user_id, now + _TTL_SECONDS)
    return user_id


# ── F6 client seats ───────────────────────────────────────────────────────────
# A seat maps a verified user to a role. Explicit user_roles rows always win —
# otherwise "Grant workspace access" would mint a login that is still a full admin
# while CLIENT_SEATS was off. No row ⇒ admin (operators provisioned without a seat
# row keep today's full access). The CLIENT_SEATS env flag is retired as a resolver
# short-circuit; presence of rows is the source of truth.


async def resolve_seat(user_id: str) -> dict:
    """Return {"role": "admin"|"client", "workspace_id": str|None} for a verified user."""
    from .db import get_pool  # local import: auth must stay importable without a pool

    pool = await get_pool()
    row = await pool.fetchrow(
        "select role, workspace_id from user_roles where user_id = $1", user_id
    )
    if row is None:
        return {"role": "admin", "workspace_id": None}
    return {
        "role": row["role"],
        "workspace_id": str(row["workspace_id"]) if row["workspace_id"] else None,
    }


async def require_workspace_seat(
    request: Request, user_id: str = Depends(require_admin)
) -> str:
    """Router-level dependency for workspace-scoped admin routers: a client seat may
    only touch its own workspace. Reads the {workspace_id} path param generically, so
    one dependency serves every router. Detail routes keyed by other ids (plan_id,
    workflow_id) pass through without a workspace_id check in v1."""
    seat = await resolve_seat(user_id)
    if seat["role"] == "client":
        ws = request.path_params.get("workspace_id")
        if ws and ws != seat["workspace_id"]:
            raise HTTPException(403, "this seat is scoped to its own workspace")
    return user_id


async def require_operator(
    user_id: str = Depends(require_admin),
) -> str:
    """Admins/operators may manage seats; client seats may not invite further clients."""
    seat = await resolve_seat(user_id)
    if seat["role"] == "client":
        raise HTTPException(403, "workspace members cannot manage seats")
    return user_id
