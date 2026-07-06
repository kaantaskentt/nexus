"""External scrape clients — Firecrawl (website) + Apify (LinkedIn people). Both are
best-effort: a failed or unconfigured scrape returns None/[] and logs, never raises
into the pipeline. Everything they return is reference material the Stage 1 structurer
tags as SCRAPED — the bottom of the trust ladder (non-negotiable #5)."""

import logging

import httpx

from .config import get_settings

log = logging.getLogger("nexus.scrape")


async def firecrawl_scrape(url: str) -> dict | None:
    """Scrape one page to markdown + metadata. Returns None on any failure."""
    key = get_settings().firecrawl_api_key
    if not key:
        log.warning("firecrawl: no api key")
        return None
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={"Authorization": f"Bearer {key}"},
                json={"url": url, "formats": ["markdown"]},
            )
            r.raise_for_status()
            data = r.json().get("data", {})
            return {"markdown": data.get("markdown", ""), "metadata": data.get("metadata", {})}
    except Exception as e:
        log.warning("firecrawl scrape failed for %s: %s", url, e)
        return None


async def apify_linkedin_people(actor_id: str, actor_input: dict) -> list | None:
    """Run an Apify actor synchronously and return its dataset items. The actor id is
    per-engagement config (LinkedIn people scrapers vary); unconfigured → None."""
    token = get_settings().apify_token
    if not token or not actor_id:
        log.warning("apify: missing token or actor_id")
        return None
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(
                f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items",
                params={"token": token},
                json=actor_input,
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        log.warning("apify actor %s failed: %s", actor_id, e)
        return None
