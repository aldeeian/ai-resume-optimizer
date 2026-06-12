"""Provider dispatch and the Gemini structured-output wrapper (SDK mocked)."""

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

import app.gemini as gemini_module
import app.llm as llm_module
from app.schemas import JobAnalysis


def _settings(provider: str) -> SimpleNamespace:
    return SimpleNamespace(
        llm_provider=provider,
        gemini_api_key="test-gemini-key",
        gemini_model="gemini-test",
    )


class FakeGeminiClient:
    """Stands in for genai.Client; pops canned response texts per call."""

    def __init__(self, texts: list[str | None]) -> None:
        self.calls: list[dict[str, Any]] = []
        generate = self._generate
        self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        self._texts = texts

    async def _generate(self, *, model: str, contents: str, config: Any) -> SimpleNamespace:
        self.calls.append({"model": model, "contents": contents, "config": config})
        return SimpleNamespace(text=self._texts.pop(0))


COMMON_KWARGS = {
    "system": "You are a test.",
    "user_content": "Analyze.",
    "tool_name": "save",
    "tool_description": "Save it.",
    "output_model": JobAnalysis,
}


# ── Dispatch ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(("provider", "called"), [("anthropic", "claude"), ("gemini", "gemini")])
async def test_dispatch_by_provider(
    monkeypatch: pytest.MonkeyPatch, provider: str, called: str
) -> None:
    seen: list[str] = []

    async def fake(**kwargs: Any) -> JobAnalysis:
        seen.append(kwargs["_origin"])
        return JobAnalysis()

    monkeypatch.setattr(
        llm_module.claude, "call_structured", lambda **kw: fake(_origin="claude", **kw)
    )
    monkeypatch.setattr(
        llm_module.gemini, "call_structured", lambda **kw: fake(_origin="gemini", **kw)
    )
    monkeypatch.setattr(llm_module, "get_settings", lambda: _settings(provider))

    await llm_module.call_structured(**COMMON_KWARGS)
    assert seen == [called]


# ── Gemini wrapper ───────────────────────────────────────────────────────────


def _patch_gemini(monkeypatch: pytest.MonkeyPatch, client: FakeGeminiClient) -> None:
    monkeypatch.setattr(gemini_module, "get_client", lambda: client)
    monkeypatch.setattr(gemini_module, "get_settings", lambda: _settings("gemini"))


async def test_gemini_parses_valid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeGeminiClient(['{"title": "Backend Intern", "company": "TechCo"}'])
    _patch_gemini(monkeypatch, client)

    result = await gemini_module.call_structured(**COMMON_KWARGS)
    assert result.title == "Backend Intern"
    assert len(client.calls) == 1
    # Schema-constrained decoding must be requested.
    assert client.calls[0]["config"].response_mime_type == "application/json"
    assert client.calls[0]["config"].response_json_schema is not None


async def test_gemini_retries_invalid_json_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeGeminiClient(["not json at all", '{"title": "Fixed"}'])
    _patch_gemini(monkeypatch, client)

    result = await gemini_module.call_structured(**COMMON_KWARGS)
    assert result.title == "Fixed"
    assert len(client.calls) == 2
    assert "schema" in client.calls[1]["contents"]


async def test_gemini_gives_up_after_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeGeminiClient(["nope", None])
    _patch_gemini(monkeypatch, client)

    with pytest.raises(HTTPException) as exc_info:
        await gemini_module.call_structured(**COMMON_KWARGS)
    assert exc_info.value.status_code == 502


async def test_gemini_missing_key_is_clear_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(gemini_module, "_client", None)
    monkeypatch.setattr(
        gemini_module,
        "get_settings",
        lambda: SimpleNamespace(gemini_api_key="", gemini_model="gemini-test"),
    )
    with pytest.raises(HTTPException) as exc_info:
        gemini_module.get_client()
    assert exc_info.value.status_code == 500
    assert "aistudio.google.com" in exc_info.value.detail
