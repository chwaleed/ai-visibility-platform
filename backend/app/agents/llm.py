"""The ONLY module that talks to the Anthropic SDK.

Swapping LLM providers later means reimplementing this file's two public
functions — nothing else in the app imports `anthropic` (deliberate; see
README "Provider portability").
"""
import logging
import os
from dataclasses import dataclass
from typing import TypeVar

from anthropic import Anthropic
from pydantic import BaseModel

logger = logging.getLogger("agents.llm")

GENERATION_MODEL = "claude-opus-4-8"   # Agents 1 & 3: quality generation
PROBE_MODEL = "claude-haiku-4-5"       # Agent 2: fast/cheap visibility probes

T = TypeVar("T", bound=BaseModel)

_client: Anthropic | None = None


class AgentError(Exception):
    """An agent call failed after retries; callers decide how to degrade."""


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


def get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    return _client


def _usage_of(response) -> Usage:
    u = getattr(response, "usage", None)
    return Usage(getattr(u, "input_tokens", 0) or 0, getattr(u, "output_tokens", 0) or 0)


def generate_structured(
    system: str, user: str, schema: type[T],
    model: str = GENERATION_MODEL, max_tokens: int = 4096,
) -> tuple[T, Usage]:
    """Schema-enforced call via messages.parse(). One retry, then AgentError.

    The schema is ALSO spelled out inside the system prompt — parse() makes
    malformed JSON nearly impossible; the prompt keeps the contract explicit.
    """
    last_error: Exception | None = None
    for attempt in (1, 2):
        try:
            response = get_client().messages.parse(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_format=schema,
            )
            if response.parsed_output is None:
                raise ValueError("model returned no parseable output")
            return response.parsed_output, _usage_of(response)
        except Exception as e:  # noqa: BLE001 — any SDK/validation failure → retry once
            last_error = e
            logger.warning("structured call failed (attempt %s/2): %s", attempt, e)
    raise AgentError(f"LLM structured call failed after 2 attempts: {last_error}")


def generate_text(
    system: str, user: str, model: str = PROBE_MODEL, max_tokens: int = 700,
) -> tuple[str, Usage]:
    """Free-text call (visibility probes — we WANT a natural answer, not JSON)."""
    response = get_client().messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    return text, _usage_of(response)
