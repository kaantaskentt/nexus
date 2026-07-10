"""Settings — loaded from .env at repo root. Brand lives in config/brand.json (A13.2)."""

import json
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    vapi_api_key: str = ""
    vapi_public_key: str = ""
    firecrawl_api_key: str = ""
    sendgrid_api_key: str = ""
    apify_token: str = ""
    fireflies_api_key: str = ""

    database_url: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Anon (publishable) key — sent as the `apikey` header when we verify a caller's
    # admin JWT against GoTrue (app/auth.py). Same key the browser client uses.
    supabase_anon_key: str = ""

    app_base_url: str = "http://localhost:8000"
    # Comma-separated browser origins allowed to call the API (CORS). Localhost dev by
    # default; deploy sets the Vercel origin(s). "*" allows any (used only if explicit).
    cors_origins: str = "http://localhost:3000"
    email_from: str = ""
    default_anthropic_chat_model: str = "claude-sonnet-4-6"
    openai_embedding_model: str = "text-embedding-3-small"

    # Gates the test-only eval-bootstrap route (A12: it only ever mints is_demo
    # sessions, and the route refuses entirely unless this is on).
    eval_mode: bool = False

    # F6 client seats (marathon July 8) — DORMANT. When off (default), the seat layer
    # short-circuits to admin with zero DB reads and the auth path is byte-for-byte
    # today's. When on, user_roles rows scope 'client' seats to their own workspace.
    client_seats: bool = False

    # Computed coverage-routing (task #12 / morning-packet §5). When on, the turn engine
    # audits objective coverage server-side each turn and hard-gates the close on any
    # untouched must-hit. Default OFF: the A/B (evals/e2e/proof-matrix.md) showed the
    # interviewer already covers explicit must-hit objectives at baseline (3/3), so the
    # per-turn classifier earns no measured gain on the motivating cases yet. The real
    # lever is plan-objective granularity, not turn-engine coverage. Flip on when an eval
    # shows a genuine untouched-must-hit-OBJECTIVE gap, or to drive a coverage UI.
    coverage_routing: bool = False

    # Shared secret VAPI sends on custom-LLM + webhook requests; when set, the voice
    # routes reject calls without it. Empty in dev.
    voice_shared_secret: str = ""

    # SIMPLIFY §6-1: hard gate on the DESTRUCTIVE company-delete endpoint. Default OFF —
    # DELETE /api/workspaces/{id} returns 403 until this is flipped on, which does not
    # happen until Kaan confirms the cascade semantics (sealed-flag ruling flagged to
    # Emre). The preview endpoint and the type-to-confirm dialog ship without this; only
    # the irreversible teardown waits behind it.
    workspace_delete_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_brand() -> dict:
    return json.loads((REPO_ROOT / "config" / "brand.json").read_text())


@lru_cache
def get_resource_packets() -> dict:
    """Section 7 Appendix A crisis-resource packets, per jurisdiction. Config, not
    prompt-baked (A14): the disclosure personas serve these numbers; the domain-neutral
    prompt never hardcodes them. The counsel/legal column is reviewer-only and is
    deliberately NOT in this file."""
    return json.loads((REPO_ROOT / "config" / "resource-packets.json").read_text())


def render_resource_packets() -> str:
    """Render the packets as the plain-text block injected at {{RESOURCE_PACKET}}. Keys
    prefixed with '_' are file metadata (source/notes) and are skipped."""
    packets = get_resource_packets().get("packets", {})
    lines: list[str] = []
    for jur in packets.values():
        lines.append(f"For {jur['label']}:")
        for r in jur.get("resources", []):
            hours = f" ({r['hours']})" if r.get("hours") else ""
            lines.append(f"- {r['name']}: {r['contact']}{hours}. For {r['for']}.")
        lines.append("")
    return "\n".join(lines).strip()
