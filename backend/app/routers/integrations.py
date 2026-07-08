"""Fireflies import (Kaan verdict 7, July 7): list recent meetings, fetch one transcript,
hand it to the discovery-upload flow. The speaker-mapping step lives in the UI (the admin
confirms who is who before compile); this router only fetches honestly.

Fireflies is GraphQL (api.fireflies.ai). FIREFLIES_API_KEY comes from the environment;
without it the endpoints answer 503 with a plain message, never a fake list. Transcript
sentences are joined VERBATIM per speaker turn — no cleanup, hedges are data."""

import json
import os
import urllib.request

from fastapi import APIRouter, HTTPException

router = APIRouter()

_FF_URL = "https://api.fireflies.ai/graphql"


def _ff_query(query: str, variables: dict | None = None) -> dict:
    """One GraphQL call. Isolated so tests monkeypatch it."""
    key = os.environ.get("FIREFLIES_API_KEY", "")
    if not key:
        raise HTTPException(503, "Fireflies isn't connected (no API key configured)")
    req = urllib.request.Request(
        _FF_URL,
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read())
    except Exception as e:
        raise HTTPException(502, f"Fireflies request failed: {type(e).__name__}") from e
    if out.get("errors"):
        raise HTTPException(502, f"Fireflies error: {out['errors'][0].get('message', 'unknown')}")
    return out.get("data") or {}


@router.get("/fireflies/meetings")
async def list_meetings(limit: int = 15):
    data = _ff_query(
        "query Transcripts($limit: Int) { transcripts(limit: $limit) "
        "{ id title date duration } }",
        {"limit": max(1, min(limit, 50))},
    )
    return [
        {
            "id": t["id"],
            "title": t.get("title") or "(untitled meeting)",
            "date": t.get("date"),
            "duration_min": round((t.get("duration") or 0)) or None,
        }
        for t in data.get("transcripts") or []
    ]


@router.get("/fireflies/meetings/{meeting_id}")
async def get_meeting_transcript(meeting_id: str):
    data = _ff_query(
        "query Transcript($id: String!) { transcript(id: $id) "
        "{ id title date sentences { speaker_name text } } }",
        {"id": meeting_id},
    )
    t = data.get("transcript")
    if not t:
        raise HTTPException(404, "meeting not found on Fireflies")
    # Merge consecutive same-speaker sentences into one verbatim turn per speaker run,
    # rendered in the "Name: text" shape parse_transcript() already understands.
    lines: list[str] = []
    speakers: list[str] = []
    cur_speaker, cur_parts = None, []
    for s in t.get("sentences") or []:
        name = (s.get("speaker_name") or "Speaker").strip()
        if name not in speakers:
            speakers.append(name)
        if name == cur_speaker:
            cur_parts.append(s.get("text") or "")
        else:
            if cur_speaker is not None:
                lines.append(f"{cur_speaker}: {' '.join(cur_parts)}")
            cur_speaker, cur_parts = name, [s.get("text") or ""]
    if cur_speaker is not None:
        lines.append(f"{cur_speaker}: {' '.join(cur_parts)}")
    return {
        "id": t["id"],
        "title": t.get("title"),
        "date": t.get("date"),
        "speakers": speakers,
        "transcript": "\n".join(lines),
    }
