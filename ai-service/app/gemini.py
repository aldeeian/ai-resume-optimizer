"""Gemini client wrapper (free-tier friendly alternative to Anthropic).

Mirrors `app.claude.call_structured`: the desired output contract is enforced
via Gemini's JSON-schema constrained decoding (`response_json_schema`), and
the result is validated with the same Pydantic model — so endpoints behave
identically regardless of provider.
"""

import json
import logging
from typing import Any, TypeVar

from fastapi import HTTPException, status
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, ValidationError

from app.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey.",
            )
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def call_structured(
    *,
    system: str,
    user_content: str,
    tool_name: str,  # noqa: ARG001 — kept for interface parity with app.claude
    tool_description: str,  # noqa: ARG001
    output_model: type[T],
    max_tokens: int = 8192,
    extra_messages: list[dict[str, Any]] | None = None,
) -> T:
    """Run one schema-constrained completion and validate the result."""
    settings = get_settings()
    client = get_client()

    schema = output_model.model_json_schema(by_alias=True)
    prompt = user_content
    if extra_messages:
        prompt += "\n\n" + "\n\n".join(str(m.get("content", "")) for m in extra_messages)

    config = genai_types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json",
        response_json_schema=schema,
        max_output_tokens=max_tokens,
    )

    # Constrained decoding occasionally drifts on complex schemas; one
    # corrective retry with the validation error called out.
    last_error = ""
    for attempt in range(2):
        contents = prompt
        if attempt > 0:
            contents += (
                "\n\nYour previous response was not valid for the required JSON schema: "
                f"{last_error[:500]}\nRespond again following the schema exactly."
            )
        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=config,
            )
        except genai_errors.APIError as exc:
            if exc.code == 429:
                logger.warning("Gemini rate limit: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="The AI provider is rate-limiting requests (Gemini free tier). "
                    "Wait a minute and try again.",
                ) from exc
            logger.error("Gemini API error %s: %s", exc.code, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI provider returned an error.",
            ) from exc
        except Exception as exc:  # connection / transport errors
            logger.error("Gemini connection error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach the AI provider.",
            ) from exc

        text = response.text
        if not text:
            last_error = "empty response"
            continue
        try:
            return output_model.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError) as exc:
            logger.warning("Gemini output failed validation (attempt %d): %s", attempt + 1, exc)
            last_error = str(exc)

    logger.error("Gemini output failed validation after retry: %s", last_error)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The model returned output that failed validation.",
    )
