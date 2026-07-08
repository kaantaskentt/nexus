"""Fireflies import router (Kaan verdict 7): GraphQL is mocked — these pin the shaping
(consecutive same-speaker sentences merge into one verbatim turn, speakers listed in
order of appearance) and the honest no-key 503."""

import pytest
from fastapi import HTTPException

from app.routers import integrations


async def test_transcript_shapes_into_speaker_turns(monkeypatch):
    def _fake(query, variables=None):
        return {"transcript": {
            "id": "m1", "title": "CEO call", "date": 1783460000000,
            "sentences": [
                {"speaker_name": "Kaan Taskent", "text": "So mornings start with prices."},
                {"speaker_name": "Kaan Taskent", "text": "Everything waits on those."},
                {"speaker_name": "Interviewer", "text": "Who does the repricing?"},
                {"speaker_name": "Kaan Taskent", "text": "Deniz does, his own sheet."},
            ],
        }}

    monkeypatch.setattr(integrations, "_ff_query", _fake)
    out = await integrations.get_meeting_transcript("m1")
    assert out["speakers"] == ["Kaan Taskent", "Interviewer"]
    lines = out["transcript"].split("\n")
    assert lines[0] == "Kaan Taskent: So mornings start with prices. Everything waits on those."
    assert lines[1] == "Interviewer: Who does the repricing?"
    assert lines[2] == "Kaan Taskent: Deniz does, his own sheet."


async def test_meetings_list_shapes(monkeypatch):
    def _fake(query, variables=None):
        return {"transcripts": [
            {"id": "a", "title": None, "date": 1, "duration": 42.4},
            {"id": "b", "title": "Weekly", "date": 2, "duration": 0},
        ]}

    monkeypatch.setattr(integrations, "_ff_query", _fake)
    out = await integrations.list_meetings()
    assert out[0]["title"] == "(untitled meeting)"
    assert out[0]["duration_min"] == 42
    assert out[1]["duration_min"] is None


async def test_no_key_is_honest_503(monkeypatch):
    monkeypatch.delenv("FIREFLIES_API_KEY", raising=False)
    with pytest.raises(HTTPException) as e:
        integrations._ff_query("query { x }")
    assert e.value.status_code == 503
