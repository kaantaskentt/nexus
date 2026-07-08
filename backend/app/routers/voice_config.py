"""Per-workspace voice settings (Sprint-2 Lane B / task #39).

Lets an admin tune the interview voice from inside Nexus — no VAPI dashboard. Three
surfaces:

- GET  /api/voice-config/{workspace_id}        (admin) — the editor's current state + voice library
- PUT  /api/voice-config/{workspace_id}        (admin) — save + push to VAPI server-side
- GET  /api/voice-config/by-token/{token}      (PUBLIC) — the CALL contract voice-room consumes

The private VAPI key never leaves the server: the browser only ever learns which
assistant id a call should use (resolved from the token). The editor writes config to our
DB and, when a VAPI key is configured, provisions/updates a DEDICATED assistant for the
workspace (never the shared asteria/orion — that would change every tenant's voice, A12).
If no key is set or the push fails, config still saves and vapi_synced=false is reported
honestly — no faked success, no fake preview.

Router is mounted WITHOUT the blanket admin dependency (main.py); the editor routes carry
require_admin themselves and the by-token resolver stays public, mirroring sessions.py."""

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import require_admin
from ..config import get_settings
from ..db import get_pool
from ..vapi_assistant import (
    BROWSER_UA,
    DEFAULT_ASSISTANT_IDS,
    DEFAULT_VOICE_ID,
    GENDER_FOR_VOICE,
    VAPI_BASE,
    VOICE_IDS,
    VOICE_LIBRARY,
    build_assistant_config,
    first_message_block,
    voice_block,
)

router = APIRouter()


def _public_base_url() -> str:
    """Where the dedicated assistant should POST turns/webhooks — the deployed API origin,
    same resolution provision_vapi.py uses so a workspace assistant hits our live endpoints
    and not localhost."""
    import os

    return (
        os.environ.get("VOICE_PUBLIC_URL")
        or os.environ.get("APP_BASE_URL")
        or "https://nexus-api-production-d644.up.railway.app"
    ).rstrip("/")


# ── Read model ───────────────────────────────────────────────────────────────


def _resolved_assistant(row) -> dict:
    """The assistant + opener a call for this workspace uses. Dedicated assistant if the
    workspace provisioned one; otherwise the shared default (ElevenLabs 'ryan' + canned
    fast opener) — the global default voice Kaan picked from the July 7 casting call (A20).
    Both shared default assistants are PATCHed to the ryan recipe, so uncustomized
    workspaces get ryan with the fast opener; first_message None lets the assistant's own
    canned firstMessage play (no slow model-generated opener)."""
    if row is None:
        gender = GENDER_FOR_VOICE[DEFAULT_VOICE_ID]
        return {"assistant_id": DEFAULT_ASSISTANT_IDS[gender], "first_message": None,
                "voice_id": DEFAULT_VOICE_ID, "gender": gender, "speed": 1.0}
    gender = row["gender"]
    assistant_id = row["vapi_assistant_id"] or DEFAULT_ASSISTANT_IDS.get(gender, DEFAULT_ASSISTANT_IDS["F"])
    return {
        "assistant_id": assistant_id,
        "first_message": row["first_message"],
        "voice_id": row["voice_id"],
        "gender": gender,
        "speed": float(row["speed"]),
    }


def _editor_state(row) -> dict:
    resolved = _resolved_assistant(row)
    return {
        "gender": resolved["gender"],
        "voice_id": resolved["voice_id"],
        "speed": resolved["speed"],
        "first_message": resolved["first_message"],
        "assistant_id": resolved["assistant_id"],
        "is_custom": bool(row and row["vapi_assistant_id"]),
        "vapi_synced": bool(row and row["vapi_synced"]),
        "vapi_configured": bool(get_settings().vapi_api_key),
        "voices": VOICE_LIBRARY,
    }


# ── VAPI push (server-side, private key only) ────────────────────────────────


async def _vapi(method: str, path: str, body: dict | None = None) -> dict:
    key = get_settings().vapi_api_key
    if not key:
        raise RuntimeError("VAPI_API_KEY not configured")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.request(method, f"{VAPI_BASE}{path}", headers=headers, json=body)
    if resp.status_code >= 400:
        raise RuntimeError(f"VAPI {method} {path} -> {resp.status_code}: {resp.text[:300]}")
    return resp.json() if resp.content else {}


async def _sync_to_vapi(workspace_id: str, row) -> str:
    """Provision or update this workspace's DEDICATED assistant to match its config and
    return the assistant id. Never touches the shared defaults. Raises on any VAPI error
    so the caller can record vapi_synced=false honestly."""
    name = f"Nexus Interviewer — {str(workspace_id)[:8]}"
    existing = row["vapi_assistant_id"]
    if existing:
        # Patch only the knobs the admin controls; the brain/transport config is untouched.
        patch = {
            "name": name,
            "voice": voice_block(row["voice_id"], float(row["speed"])),
            **first_message_block(row["first_message"]),
        }
        await _vapi("PATCH", f"/assistant/{existing}", patch)
        return existing
    # First customization → create a dedicated assistant from the shared template.
    cfg = build_assistant_config(
        name, row["voice_id"], _public_base_url(), get_settings().voice_shared_secret,
        speed=float(row["speed"]), first_message=row["first_message"],
    )
    created = await _vapi("POST", "/assistant", cfg)
    new_id = created.get("id")
    if not new_id:
        raise RuntimeError("VAPI created an assistant with no id")
    return new_id


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/{workspace_id}", dependencies=[Depends(require_admin)])
async def get_voice_config(workspace_id: str):
    pool = await get_pool()
    if await pool.fetchval("select 1 from workspaces where id = $1", workspace_id) is None:
        raise HTTPException(404, "workspace not found")
    row = await pool.fetchrow("select * from voice_configs where workspace_id = $1", workspace_id)
    return _editor_state(row)


@router.post("/{workspace_id}/test-session", dependencies=[Depends(require_admin)])
async def create_test_session(workspace_id: str):
    """'Hear it live' (premium audit P1-3): mint a throwaway voice_test session so the
    admin can audition the workspace's ACTUAL assistant — real opener, real voice, real
    timing — in one click. Firewalled by kind: never compiles, never screened, never
    listed as an interview. The link expires like any invite; nothing to clean up."""
    import secrets

    pool = await get_pool()
    if await pool.fetchval("select 1 from workspaces where id = $1", workspace_id) is None:
        raise HTTPException(404, "workspace not found")
    token = secrets.token_urlsafe(24)
    await pool.execute(
        """insert into interview_sessions
             (workspace_id, modality, language, invite_token, status, session_kind)
           values ($1, 'voice', 'en', $2, 'pending', 'voice_test')""",
        workspace_id, token,
    )
    return {"token": token, "invite_path": f"/i/{token}"}


class VoiceConfigIn(BaseModel):
    voice_id: str
    speed: float = Field(1.0, ge=0.5, le=2.0)
    first_message: str | None = None


@router.put("/{workspace_id}", dependencies=[Depends(require_admin)])
async def put_voice_config(workspace_id: str, body: VoiceConfigIn):
    if body.voice_id not in VOICE_IDS:
        raise HTTPException(422, "unknown voice_id")
    gender = GENDER_FOR_VOICE[body.voice_id]  # gender is derived from the chosen voice
    first_message = (body.first_message or "").strip() or None

    pool = await get_pool()
    if await pool.fetchval("select 1 from workspaces where id = $1", workspace_id) is None:
        raise HTTPException(404, "workspace not found")

    # Persist first (source of truth), then attempt the VAPI push. A push failure never
    # loses the admin's saved settings — it only leaves vapi_synced=false with an honest note.
    row = await pool.fetchrow(
        """insert into voice_configs (workspace_id, gender, voice_id, speed, first_message, vapi_synced, updated_at)
           values ($1, $2, $3, $4, $5, false, now())
           on conflict (workspace_id) do update
             set gender = excluded.gender, voice_id = excluded.voice_id, speed = excluded.speed,
                 first_message = excluded.first_message, vapi_synced = false, updated_at = now()
           returning *""",
        workspace_id, gender, body.voice_id, body.speed, first_message,
    )

    sync_error: str | None = None
    if not get_settings().vapi_api_key:
        sync_error = "Voice is not connected on the server, so the change is saved but not yet live on calls."
    else:
        try:
            assistant_id = await _sync_to_vapi(workspace_id, row)
            row = await pool.fetchrow(
                """update voice_configs set vapi_assistant_id = $2, vapi_synced = true, updated_at = now()
                   where workspace_id = $1 returning *""",
                workspace_id, assistant_id,
            )
        except Exception as e:  # noqa: BLE001 — surface the reason, never crash the save
            sync_error = f"Saved, but the voice service did not accept the update: {e}"

    return {**_editor_state(row), "sync_error": sync_error}


def _session_pin(resumable_state) -> dict | None:
    """A session may pin a specific assistant in its resumable_state, overriding the
    workspace default (casting call #41). This lets N links on ONE tenant each use a
    DIFFERENT assistant — an A/B/C/D voice bake-off — without N workspaces. No pin => normal
    per-workspace resolution. resumable_state is a jsonb dict (codec-decoded); guard for str."""
    state = resumable_state
    if isinstance(state, str):
        try:
            state = json.loads(state)
        except (ValueError, TypeError):
            state = None
    if isinstance(state, dict) and state.get("voice_assistant_id"):
        return {
            "assistant_id": state["voice_assistant_id"],
            "first_message": state.get("voice_first_message"),
            "voice_id": state.get("voice_voice_id", "custom"),
            "gender": state.get("voice_gender", "F"),
            "speed": state.get("voice_speed", 1.0),
        }
    return None


@router.get("/by-token/{token}")
async def voice_config_by_token(token: str):
    """PUBLIC call contract (voice-room / VoiceCall): resolve which assistant + opener this
    session uses. A per-session pin wins (casting call), else the session's workspace config,
    else the shared default. Token-keyed like the other interviewee routes; an expired or
    unknown token is a 404."""
    pool = await get_pool()
    sess = await pool.fetchrow(
        """select workspace_id, resumable_state from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if sess is None:
        raise HTTPException(404, "invalid or expired invite")
    pinned = _session_pin(sess["resumable_state"])
    if pinned is not None:
        return pinned
    row = await pool.fetchrow("select * from voice_configs where workspace_id = $1", sess["workspace_id"])
    return _resolved_assistant(row)
