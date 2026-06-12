from app.schemas import ParsedResume
from app.truthfulness import validate_generated_resume, validate_letter_numbers


def _tailored_copy(source: ParsedResume) -> ParsedResume:
    """A legitimate tailoring: reworded bullets, same facts."""
    generated = source.model_copy(deep=True)
    generated.summary = "Backend-focused CS student targeting platform teams."
    generated.experiences[0].bullets = [
        "Developed FastAPI REST endpoints handling 200 requests per second",
    ]
    return generated


def test_truthful_rewrite_passes(source_resume: ParsedResume) -> None:
    assert validate_generated_resume(source_resume, _tailored_copy(source_resume)) == []


def test_invented_employer_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.experiences[0].company = "Google"
    violations = validate_generated_resume(source_resume, generated)
    assert any("Invented employer" in v for v in violations)


def test_changed_title_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.experiences[0].title = "Senior Staff Engineer"
    violations = validate_generated_resume(source_resume, generated)
    assert any("Changed job title" in v for v in violations)


def test_changed_dates_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.experiences[0].start_date = "Jan 2020"
    violations = validate_generated_resume(source_resume, generated)
    assert any("Changed dates" in v for v in violations)


def test_invented_project_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.projects[0].name = "Mars Rover OS"
    violations = validate_generated_resume(source_resume, generated)
    assert any("Invented project" in v for v in violations)


def test_invented_institution_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.education[0].institution = "MIT"
    violations = validate_generated_resume(source_resume, generated)
    assert any("Invented institution" in v for v in violations)


def test_added_skill_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.skills = [*generated.skills, "Kubernetes"]
    violations = validate_generated_resume(source_resume, generated)
    assert any("Added skill" in v for v in violations)


def test_invented_metric_flagged(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.experiences[0].bullets = ["Cut costs by 95% across 12 services"]
    violations = validate_generated_resume(source_resume, generated)
    assert any("Invented metric" in v for v in violations)


def test_existing_metric_allowed(source_resume: ParsedResume) -> None:
    generated = _tailored_copy(source_resume)
    generated.experiences[0].bullets = ["Sped up reporting by 40% for analytics users"]
    assert validate_generated_resume(source_resume, generated) == []


# ── Cover letter figures ─────────────────────────────────────────────────────


def test_letter_with_resume_figures_passes(source_resume: ParsedResume) -> None:
    letter = "At Acme Corp I cut report generation time by 40%."
    assert validate_letter_numbers(source_resume, letter) == []


def test_letter_with_invented_figure_flagged(source_resume: ParsedResume) -> None:
    letter = "I increased revenue by $3M in my first month."
    violations = validate_letter_numbers(source_resume, letter)
    assert violations and "3" in violations[0]
