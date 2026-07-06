"""Create (or update) an admin login for the Nexus workspace picker (A17).

Admin auth is minimal and manual: there is NO signup flow. This script provisions a
Supabase Auth email+password user directly in the database, which is the supported path
when the service-role key isn't on hand — it writes the same rows the Admin API would.

    python -m scripts.create_admin admin@nexus.app 'a-strong-password'
    python -m scripts.create_admin admin@nexus.app 'new-password' --reset   # rotate pw

Runs against DATABASE_URL (the Supabase pooler). Idempotent: re-running for an existing
email is a no-op unless --reset is passed, which re-hashes the password.

Why the token-column normalization below: GoTrue scans auth.users token columns
(confirmation_token, recovery_token, ...) into non-nullable Go strings, so a manual
insert that leaves them NULL makes sign-in fail with "Database error querying schema".
We coalesce them to '' — the value GoTrue itself writes.
"""

import argparse
import asyncio

from app.config import get_settings
from app.db import close_pool, get_pool

_TOKEN_COLUMNS = [
    "confirmation_token", "recovery_token", "email_change",
    "email_change_token_new", "email_change_token_current",
    "phone_change", "phone_change_token", "reauthentication_token",
]


async def create_admin(email: str, password: str, reset: bool = False) -> None:
    if not get_settings().database_url:
        raise SystemExit("DATABASE_URL is not set")
    pool = await get_pool()

    uid = await pool.fetchval("select id from auth.users where email = $1", email)
    if uid and not reset:
        print(f"admin already exists: {email} ({uid}) — pass --reset to rotate the password")
        return

    if uid is None:
        uid = await pool.fetchval(
            """insert into auth.users (
                 instance_id, id, aud, role, email, encrypted_password,
                 email_confirmed_at, created_at, updated_at,
                 raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
               ) values (
                 '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
                 'authenticated', 'authenticated', $1, crypt($2, gen_salt('bf')),
                 now(), now(), now(),
                 '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false
               ) returning id""",
            email, password,
        )
        print(f"created user: {email} ({uid})")
    else:
        await pool.execute(
            "update auth.users set encrypted_password = crypt($2, gen_salt('bf')), "
            "updated_at = now() where id = $1",
            uid, password,
        )
        print(f"reset password for: {email} ({uid})")

    # Email identity — required for password sign-in.
    has_identity = await pool.fetchval(
        "select exists(select 1 from auth.identities where user_id = $1)", uid
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
            uid, str(uid), email,
        )
        print("created email identity")

    coalesce = ", ".join(f"{c} = coalesce({c}, '')" for c in _TOKEN_COLUMNS)
    await pool.execute(f"update auth.users set {coalesce} where id = $1", uid)
    print("normalized token columns — sign-in ready")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("email")
    ap.add_argument("password")
    ap.add_argument("--reset", action="store_true", help="rotate the password if the user exists")
    args = ap.parse_args()
    try:
        await create_admin(args.email, args.password, reset=args.reset)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
