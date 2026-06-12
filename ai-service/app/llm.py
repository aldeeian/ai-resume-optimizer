"""Provider-agnostic structured-output entry point.

Endpoints call `call_structured` here; the configured provider (Anthropic by
default, Gemini via LLM_PROVIDER=gemini) does the work. Both implementations
share the same contract: schema-enforced output validated into the given
Pydantic model, with provider errors mapped to clean HTTP errors.
"""

from typing import Any, TypeVar

from pydantic import BaseModel

from app import claude, gemini
from app.config import get_settings

T = TypeVar("T", bound=BaseModel)


async def call_structured(
    *,
    system: str,
    user_content: str,
    tool_name: str,
    tool_description: str,
    output_model: type[T],
    max_tokens: int = 8192,
    extra_messages: list[dict[str, Any]] | None = None,
) -> T:
    provider = gemini if get_settings().llm_provider == "gemini" else claude
    return await provider.call_structured(
        system=system,
        user_content=user_content,
        tool_name=tool_name,
        tool_description=tool_description,
        output_model=output_model,
        max_tokens=max_tokens,
        extra_messages=extra_messages,
    )
