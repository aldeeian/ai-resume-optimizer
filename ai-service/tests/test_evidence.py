from app.schemas import BulletEvidence, ParsedResume
from app.truthfulness import verify_evidence


def _generated(source: ParsedResume) -> ParsedResume:
    generated = source.model_copy(deep=True)
    generated.summary = "Backend developer with FastAPI experience."
    generated.experiences[0].bullets = ["Developed high-throughput FastAPI REST endpoints"]
    generated.projects[0].bullets = ["Built fraud model with XGBoost"]
    return generated


def _full_evidence() -> list[BulletEvidence]:
    return [
        BulletEvidence(
            section="summary",
            sources=["CS student focused on backend systems."],
        ),
        BulletEvidence(
            section="experience",
            entry_index=0,
            bullet_index=0,
            sources=["Built REST endpoints in FastAPI serving 200 requests per second"],
        ),
        BulletEvidence(
            section="project",
            entry_index=0,
            bullet_index=0,
            sources=["Trained XGBoost model on 100k transactions"],
        ),
    ]


def test_verbatim_quotes_verify_and_cover_everything(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    checked, uncovered = verify_evidence(source_resume, generated, _full_evidence())
    assert uncovered == []
    assert len(checked) == 3
    assert all(item.verified for item in checked)


def test_quote_matching_ignores_case_and_whitespace(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    evidence = _full_evidence()
    evidence[1].sources = ["built rest endpoints in   FASTAPI serving 200 requests per second"]
    checked, _ = verify_evidence(source_resume, generated, evidence)
    assert checked[1].verified


def test_fabricated_quote_not_verified(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    evidence = _full_evidence()
    evidence[1].sources = ["Led a team of 50 engineers at NASA"]
    checked, uncovered = verify_evidence(source_resume, generated, evidence)
    assert not checked[1].verified
    assert any("experience[0]" in ref for ref in uncovered)


def test_too_short_quote_does_not_count(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    evidence = _full_evidence()
    evidence[1].sources = ["FastAPI"]  # appears in source but too weak as provenance
    checked, uncovered = verify_evidence(source_resume, generated, evidence)
    assert not checked[1].verified
    assert len(uncovered) == 1


def test_out_of_range_evidence_dropped(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    evidence = [
        *_full_evidence(),
        BulletEvidence(
            section="experience",
            entry_index=9,
            bullet_index=0,
            sources=["Built REST endpoints in FastAPI serving 200 requests per second"],
        ),
    ]
    checked, _ = verify_evidence(source_resume, generated, evidence)
    assert len(checked) == 3  # the dangling entry is gone


def test_missing_evidence_reports_every_bullet(source_resume: ParsedResume) -> None:
    generated = _generated(source_resume)
    _, uncovered = verify_evidence(source_resume, generated, [])
    # summary + 1 experience bullet + 1 project bullet
    assert len(uncovered) == 3
    assert uncovered[0] == "summary"
