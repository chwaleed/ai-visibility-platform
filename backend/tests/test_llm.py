from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

from app.agents import llm
from app.agents.llm import AgentError, generate_structured, generate_text


class Demo(BaseModel):
    answer: str


def _parse_response(obj):
    return SimpleNamespace(
        parsed_output=obj,
        usage=SimpleNamespace(input_tokens=10, output_tokens=20),
    )


def test_generate_structured_success(monkeypatch):
    client = MagicMock()
    client.messages.parse.return_value = _parse_response(Demo(answer="hi"))
    monkeypatch.setattr(llm, "get_client", lambda: client)

    result, usage = generate_structured("sys", "user", Demo)
    assert result.answer == "hi"
    assert usage.input_tokens == 10 and usage.output_tokens == 20


def test_generate_structured_retries_once_then_succeeds(monkeypatch):
    client = MagicMock()
    client.messages.parse.side_effect = [
        RuntimeError("malformed"),
        _parse_response(Demo(answer="second try")),
    ]
    monkeypatch.setattr(llm, "get_client", lambda: client)

    result, _ = generate_structured("sys", "user", Demo)
    assert result.answer == "second try"
    assert client.messages.parse.call_count == 2


def test_generate_structured_raises_agent_error_after_retries(monkeypatch):
    client = MagicMock()
    client.messages.parse.side_effect = RuntimeError("still malformed")
    monkeypatch.setattr(llm, "get_client", lambda: client)

    with pytest.raises(AgentError):
        generate_structured("sys", "user", Demo)
    assert client.messages.parse.call_count == 2


def test_generate_text_joins_text_blocks(monkeypatch):
    client = MagicMock()
    client.messages.create.return_value = SimpleNamespace(
        content=[
            SimpleNamespace(type="text", text="Try Surfer SEO"),
            SimpleNamespace(type="text", text=" or Clearscope."),
        ],
        usage=SimpleNamespace(input_tokens=5, output_tokens=9),
    )
    monkeypatch.setattr(llm, "get_client", lambda: client)

    text, usage = generate_text("sys", "what tool?")
    assert text == "Try Surfer SEO or Clearscope."
    assert usage.total == 14
