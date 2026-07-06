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

    # Shared secret VAPI sends on custom-LLM + webhook requests; when set, the voice
    # routes reject calls without it. Empty in dev.
    voice_shared_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_brand() -> dict:
    return json.loads((REPO_ROOT / "config" / "brand.json").read_text())
