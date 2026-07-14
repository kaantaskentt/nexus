"""Workspace seat provisioning (F6 grant).

Creates a Supabase Auth login (same shape as scripts/create_admin) and a
user_roles client row scoped to one workspace. Email delivery is still deferred
(FOR-TUNC #10) — the temporary password is returned once for the admin to share.
"""

from __future__ import annotations

import json
import secrets

from fastapi import HTTPException

from .db import get_pool

_TOKEN_COLUMNS = [
    "confirmation_token",
    "recovery_token",
    "email_change",
    "email_change_token_new",
    "email_change_token_current",
    "phone_change",
    "phone_change_token",
    "reauthentication_token",
]


async def _auth_users_ready(pool) -> bool:
    return bool(
        await pool.fetchval(
            "select exists("
            "  select 1 from information_schema.tables "
            "  where table_schema = 'auth' and table_name = 'users'"
            ")"
        )
    )


async def ensure_auth_user(email: str, *, display_name: str | None = None) -> tuple[str, str | None]:
    """Find or create an auth.users login. Returns (user_id, temporary_password).

    temporary_password is set only when a NEW login is minted (or when the test DB
    has no auth schema and we mint a synthetic id). Existing users keep their
    password — we never rotate on grant.
    """
    email = email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(422, "a valid email is required")
    pool = await get_pool()

    if not await _auth_users_ready(pool):
        # Local test DB has no GoTrue schema — still mint a stable seat row.
        uid = await pool.fetchval("select gen_random_uuid()::text")
        return str(uid), secrets.token_urlsafe(12)

    uid = await pool.fetchval("select id::text from auth.users where lower(email) = $1", email)
    if uid:
        return str(uid), None

    password = secrets.token_urlsafe(12)
    meta = {}
    if display_name and display_name.strip():
        meta["full_name"] = display_name.strip()
    uid = await pool.fetchval(
        """insert into auth.users (
             instance_id, id, aud, role, email, encrypted_password,
             email_confirmed_at, created_at, updated_at,
             raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
           ) values (
             '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
             'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')),
             now(), now(), now(),
             '{"provider":"email","providers":["email"]}'::jsonb,
             $3::jsonb, false, false
           ) returning id::text""",
        email,
        password,
        json.dumps(meta),
    )
    has_identity = await pool.fetchval(
        "select exists(select 1 from auth.identities where user_id = $1::uuid)", uid
    )
    if not has_identity:
        await pool.execute(
            """insert into auth.identities (
                 id, user_id, provider_id, identity_data, provider,
                 last_sign_in_at, created_at, updated_at
               ) values (
                 gen_random_uuid(), $1::uuid, $2::text,
                 jsonb_build_object('sub', $2::text, 'email', $3::text,
                   'email_verified', true, 'phone_verified', false),
                 'email', now(), now(), now()
               )""",
            uid,
            str(uid),
            email,
        )
    coalesce = ", ".join(f"{c} = coalesce({c}, '')" for c in _TOKEN_COLUMNS)
    await pool.execute(f"update auth.users set {coalesce} where id = $1::uuid", uid)
    return str(uid), password


def _seat_row(r) -> dict:
    entity_id = r["entity_id"]
    created = r["created_at"]
    return {
        "user_id": str(r["user_id"]),
        "email": r["email"],
        "role": r["role"],
        "workspace_id": str(r["workspace_id"]) if r["workspace_id"] else None,
        "entity_id": str(entity_id) if entity_id else None,
        "created_at": created.isoformat() if created else None,
    }


async def list_workspace_seats(workspace_id: str) -> list[dict]:
    pool = await get_pool()
    if not await pool.fetchval("select 1 from workspaces where id = $1", workspace_id):
        raise HTTPException(404, "workspace not found")
    rows = await pool.fetch(
        """select user_id, email, role, workspace_id, entity_id, created_at
           from user_roles
           where workspace_id = $1 and role = 'client'
           order by created_at""",
        workspace_id,
    )
    return [_seat_row(r) for r in rows]


async def grant_workspace_seat(
    workspace_id: str,
    *,
    email: str,
    entity_id: str | None = None,
    display_name: str | None = None,
) -> dict:
    """Grant a client seat. Returns the seat + temporary_password when a login was created."""
    email = email.strip().lower()
    pool = await get_pool()
    if not await pool.fetchval("select 1 from workspaces where id = $1", workspace_id):
        raise HTTPException(404, "workspace not found")

    if entity_id:
        ok = await pool.fetchval(
            """select 1 from entities
               where id = $1 and workspace_id = $2 and entity_type = 'person'""",
            entity_id,
            workspace_id,
        )
        if not ok:
            raise HTTPException(404, "person not found in this workspace")

    # Prefer an existing seat by email (covers re-grant without auth.users, and
    # the case where GoTrue already has the login from a prior grant).
    existing = await pool.fetchrow(
        """select user_id, email, role, workspace_id, entity_id, created_at
           from user_roles where lower(email) = $1""",
        email,
    )
    if existing:
        if existing["role"] == "admin":
            raise HTTPException(409, "that login is already a Nexus admin")
        if existing["role"] == "client" and str(existing["workspace_id"]) != workspace_id:
            raise HTTPException(409, "that login already has access to another workspace")
        updated = await pool.fetchrow(
            """update user_roles
               set email = $2, entity_id = coalesce($3, entity_id)
               where user_id = $1
               returning user_id, email, role, workspace_id, entity_id, created_at""",
            existing["user_id"],
            email,
            entity_id,
        )
        out = _seat_row(updated)
        out["created"] = False
        out["temporary_password"] = None
        return out

    user_id, temp_password = await ensure_auth_user(email, display_name=display_name)

    # Auth user existed from create_admin / prior path but had no seat yet — still check.
    by_uid = await pool.fetchrow(
        "select user_id, email, role, workspace_id, entity_id, created_at from user_roles where user_id = $1",
        user_id,
    )
    if by_uid:
        if by_uid["role"] == "admin":
            raise HTTPException(409, "that login is already a Nexus admin")
        if by_uid["role"] == "client" and str(by_uid["workspace_id"]) != workspace_id:
            raise HTTPException(409, "that login already has access to another workspace")
        updated = await pool.fetchrow(
            """update user_roles
               set email = $2, entity_id = coalesce($3, entity_id)
               where user_id = $1
               returning user_id, email, role, workspace_id, entity_id, created_at""",
            user_id,
            email,
            entity_id,
        )
        out = _seat_row(updated)
        out["created"] = False
        out["temporary_password"] = None
        return out

    row = await pool.fetchrow(
        """insert into user_roles (user_id, email, role, workspace_id, entity_id)
           values ($1, $2, 'client', $3, $4)
           returning user_id, email, role, workspace_id, entity_id, created_at""",
        user_id,
        email,
        workspace_id,
        entity_id,
    )
    out = _seat_row(row)
    out["created"] = True
    out["temporary_password"] = temp_password
    return out


async def revoke_workspace_seat(workspace_id: str, user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow(
        """delete from user_roles
           where user_id = $1 and workspace_id = $2 and role = 'client'
           returning user_id""",
        user_id,
        workspace_id,
    )
    if not row:
        raise HTTPException(404, "seat not found")
    return {"ok": True, "user_id": str(row["user_id"])}
