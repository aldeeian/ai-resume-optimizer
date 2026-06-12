"""Endpoint behavior with the LLM call mocked out.

`call_structured` is patched at `app.main` (where it is imported), so these
tests exercise auth, validation, retry policy, and post-processing — the
service's own logic — without network access.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.schemas import (
    BulletEvidence,
    CoverLetterDraft,
    GeneratedWithEvidence,
    InterviewFeedback,
    InterviewQuestionDraft,
    InterviewQuestionsDraft,
    ParsedResume,
    RankResponse,
    StarAnalysis,
)
from tests.conftest import API_KEY_HEADER

JOB = {
    "title": "Backend Intern",
    "company": "TechCo",
    "requiredSkills": ["Python"],
    "keywords": ["REST"],
}


def _mock_calls(monkeypatch: pytest.MonkeyPatch, outputs: list[Any]) -> list[dict[str, Any]]:
    """Patch call_structured to pop canned outputs; records each call's kwargs."""
    calls: list[dict[str, Any]] = []

    async def fake_call_structured(**kwargs: Any) -> Any:
        calls.append(kwargs)
        return outputs.pop(0)

    monkeypatch.setattr(main, "call_structured", fake_call_structured)
    return calls


# ── Auth ─────────────────────────────────────────────────────────────────────


def test_missing_api_key_rejected(client: TestClient) -> None:
    res = client.post("/api/v1/rank", json={"job": JOB})
    assert res.status_code == 401


def test_wrong_api_key_rejected(client: TestClient) -> None:
    res = client.post("/api/v1/rank", json={"job": JOB}, headers={"x-api-key": "nope"})
    assert res.status_code == 401


def test_health_is_public(client: TestClient) -> None:
    assert client.get("/health").status_code == 200


# ── Rank ─────────────────────────────────────────────────────────────────────


def test_rank_empty_input_skips_the_model(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = _mock_calls(monkeypatch, [])
    res = client.post("/api/v1/rank", json={"job": JOB}, headers=API_KEY_HEADER)
    assert res.status_code == 200
    assert res.json() == {"experiences": [], "projects": []}
    assert calls == []


def test_rank_backfills_items_the_model_skipped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_calls(
        monkeypatch,
        [RankResponse.model_validate({"experiences": [{"id": "e1", "score": 80}]})],
    )
    res = client.post(
        "/api/v1/rank",
        json={
            "job": JOB,
            "experiences": [{"id": "e1"}, {"id": "e2"}],
            "projects": [{"id": "p1"}],
        },
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    body = res.json()
    assert {e["id"]: e["score"] for e in body["experiences"]} == {"e1": 80, "e2": 0}
    assert body["projects"] == [
        {"id": "p1", "score": 0, "matchedTechnologies": [], "matchedSkills": []}
    ]


# ── Generate (evidence + truthfulness retry policy) ──────────────────────────


def _good_generation(source: ParsedResume) -> GeneratedWithEvidence:
    content = source.model_copy(deep=True)
    content.summary = "Backend-focused student."
    content.experiences[0].bullets = ["Developed FastAPI REST endpoints"]
    content.projects[0].bullets = ["Built fraud model with XGBoost"]
    return GeneratedWithEvidence(
        content=content,
        evidence=[
            BulletEvidence(
                section="summary", sources=["CS student focused on backend systems."]
            ),
            BulletEvidence(
                section="experience",
                sources=["Built REST endpoints in FastAPI serving 200 requests per second"],
            ),
            BulletEvidence(
                section="project", sources=["Trained XGBoost model on 100k transactions"]
            ),
        ],
    )


def _bad_generation(source: ParsedResume) -> GeneratedWithEvidence:
    generated = _good_generation(source)
    generated.content.experiences[0].company = "Google"  # invented employer
    return generated


def test_generate_happy_path_returns_verified_evidence(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    calls = _mock_calls(monkeypatch, [_good_generation(source_resume)])
    res = client.post(
        "/api/v1/generate",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    body = res.json()
    assert len(calls) == 1  # no retry needed
    assert len(body["evidence"]) == 3
    assert all(item["verified"] for item in body["evidence"])


def test_generate_retries_then_succeeds(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    calls = _mock_calls(
        monkeypatch, [_bad_generation(source_resume), _good_generation(source_resume)]
    )
    res = client.post(
        "/api/v1/generate",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    assert len(calls) == 2
    # The retry prompt must name the specific problem.
    assert "Invented employer" in calls[1]["user_content"]


def test_generate_rejects_persistent_violations(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    _mock_calls(
        monkeypatch, [_bad_generation(source_resume), _bad_generation(source_resume)]
    )
    res = client.post(
        "/api/v1/generate",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 422


def test_generate_unverified_evidence_is_flagged_not_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    uncited = _good_generation(source_resume)
    uncited.evidence = []  # truthful content, but no provenance at all
    _mock_calls(monkeypatch, [uncited, uncited])
    res = client.post(
        "/api/v1/generate",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    assert res.json()["evidence"] == []


def test_generate_empty_resume_rejected(client: TestClient) -> None:
    res = client.post(
        "/api/v1/generate",
        json={"job": JOB, "resume": {}},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 422


# ── Cover letter ─────────────────────────────────────────────────────────────


def test_cover_letter_happy_path(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    letter = (
        "Dear Hiring Manager,\n\nAt Acme Corp I reduced report generation time by 40% "
        "and built REST endpoints in FastAPI. " + "More relevant detail. " * 10 + "\n\nSam Carter"
    )
    _mock_calls(monkeypatch, [CoverLetterDraft(content=letter)])
    res = client.post(
        "/api/v1/cover-letter",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True), "tone": "concise"},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    assert res.json()["content"] == letter


def test_cover_letter_rejects_persistent_invented_figures(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    bad = CoverLetterDraft(content="I grew revenue 300% at Acme Corp. " * 10)
    _mock_calls(monkeypatch, [bad, bad])
    res = client.post(
        "/api/v1/cover-letter",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 422


def test_cover_letter_empty_resume_rejected(client: TestClient) -> None:
    res = client.post(
        "/api/v1/cover-letter",
        json={"job": JOB, "resume": {}},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 422


# ── Interview ────────────────────────────────────────────────────────────────


def test_interview_questions_get_server_ids_and_cap(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    drafts = InterviewQuestionsDraft(
        questions=[
            InterviewQuestionDraft(
                type="behavioral", question=f"Question {i}?", focus_area="teamwork"
            )
            for i in range(5)
        ]
    )
    _mock_calls(monkeypatch, [drafts])
    res = client.post(
        "/api/v1/interview/questions",
        json={
            "job": JOB,
            "resume": source_resume.model_dump(by_alias=True),
            "numQuestions": 3,
        },
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    questions = res.json()["questions"]
    assert [q["id"] for q in questions] == ["q1", "q2", "q3"]  # capped + server ids


def test_interview_questions_empty_model_output_is_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, source_resume: ParsedResume
) -> None:
    _mock_calls(monkeypatch, [InterviewQuestionsDraft(questions=[])])
    res = client.post(
        "/api/v1/interview/questions",
        json={"job": JOB, "resume": source_resume.model_dump(by_alias=True)},
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 502


def test_feedback_keeps_star_for_behavioral(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_calls(
        monkeypatch,
        [
            InterviewFeedback(
                score=75,
                strengths=["Specific example"],
                improvements=["Quantify the result"],
                star=StarAnalysis(situation=True, task=True, action=True, result=False),
                example_answer="…",
            )
        ],
    )
    res = client.post(
        "/api/v1/interview/feedback",
        json={
            "job": JOB,
            "question": {"id": "q1", "type": "behavioral", "question": "Tell me about a time…"},
            "answer": "When our intern project slipped, I reorganized the testing plan.",
        },
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    assert res.json()["star"]["situation"] is True


def test_feedback_strips_star_for_technical(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_calls(
        monkeypatch,
        [
            InterviewFeedback(
                score=60,
                strengths=["Correct definition"],
                improvements=["Mention indexing trade-offs"],
                star=StarAnalysis(situation=True),  # model mistakenly returned STAR
            )
        ],
    )
    res = client.post(
        "/api/v1/interview/feedback",
        json={
            "job": JOB,
            "question": {"id": "q2", "type": "technical", "question": "What is an index?"},
            "answer": "An index is a data structure that speeds up lookups in a database.",
        },
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 200
    assert res.json()["star"] is None


def test_feedback_rejects_too_short_answer(client: TestClient) -> None:
    res = client.post(
        "/api/v1/interview/feedback",
        json={
            "job": JOB,
            "question": {"id": "q1", "type": "technical", "question": "What is an index?"},
            "answer": "idk",
        },
        headers=API_KEY_HEADER,
    )
    assert res.status_code == 422
