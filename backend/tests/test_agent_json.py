"""run_agent_json parse-or-die contract (#22). The old idiom swallowed unparseable
agent output and let the job report success with nothing written; the fix raises so the
owning job fails and retries. These guard against a regression back to the silent drop."""

import pytest

from app import llm


async def test_run_agent_json_parses_valid_output(monkeypatch):
    async def _ok(agent_name, content, **kw):
        return 'Here you go: [{"a": 1}]'  # prose-wrapped JSON, extract_json tolerates it
    monkeypatch.setattr("app.llm.run_agent", _ok)
    assert await llm.run_agent_json("any_agent", "x") == [{"a": 1}]


async def test_run_agent_json_raises_on_unparseable_output(monkeypatch):
    async def _prose(agent_name, content, **kw):
        return "An assessment in prose, with no JSON object anywhere."
    monkeypatch.setattr("app.llm.run_agent", _prose)
    with pytest.raises(llm.AgentParseError):
        await llm.run_agent_json("interview_quality", "x")


def test_agent_parse_error_is_not_valueerror():
    # Must not subclass ValueError, or the pipeline's historical `except ValueError`
    # sites could re-swallow it — the whole point of #22 is that it propagates.
    assert not issubclass(llm.AgentParseError, ValueError)
