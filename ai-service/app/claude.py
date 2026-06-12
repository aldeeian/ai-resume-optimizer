"""Anthropic client wrapper.

Every call forces a tool invocation whose input schema is the desired output
contract, so responses are schema-guaranteed JSON — no free-text parsing.
"""

import logging
from typing import Any, TypeVar

import anthropic
from fastapi import HTTPException, status
from pydantic import BaseModel, ValidationError

from app.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ANTHROPIC_API_KEY is not set. Set it, or use LLM_PROVIDER=gemini.",
            )
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


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
    """Run one forced-tool-use completion and validate the result."""
    settings = get_settings()
    client = get_client()

    schema = output_model.model_json_schema(by_alias=True)

    messages: list[dict[str, Any]] = [{"role": "user", "content": user_content}]
    if extra_messages:
        messages.extend(extra_messages)

    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,  # type: ignore[arg-type]
            tools=[
                {
                    "name": tool_name,
                    "description": tool_description,
                    "input_schema": schema,
                }
            ],
            tool_choice={"type": "tool", "name": tool_name},
        )
    except anthropic.RateLimitError as exc:
        logger.warning("Anthropic rate limit: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI provider is rate-limiting requests. Try again shortly.",
        ) from exc
    except anthropic.APIStatusError as exc:
        logger.error("Anthropic API error %s: %s", exc.status_code, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an error.",
        ) from exc
    except anthropic.APIConnectionError as exc:
        logger.error("Anthropic connection error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach the AI provider.",
        ) from exc

    tool_input: dict[str, Any] | None = None
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            tool_input = block.input  # type: ignore[assignment]
            break

    if tool_input is None:
        logger.error("Model returned no tool_use block (stop_reason=%s)", response.stop_reason)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The model did not return structured output.",
        )

    try:
        return output_model.model_validate(tool_input)
    except ValidationError as exc:
        logger.error("Model output failed validation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The model returned output that failed validation.",
        ) from exc
