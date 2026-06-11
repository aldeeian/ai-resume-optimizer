"""Post-generation truthfulness validation.

Cross-checks every load-bearing fact in the generated resume against the
source resume. The generator is prompt-constrained, but prompts are not
guarantees — this is the enforcement layer.
"""

import re

from app.schemas import ParsedResume


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def validate_generated_resume(source: ParsedResume, generated: ParsedResume) -> list[str]:
    """Return a list of violations (empty = truthful)."""
    violations: list[str] = []

    src_companies = {_norm(e.company) for e in source.experiences}
    src_exp_pairs = {(_norm(e.company), _norm(e.title)) for e in source.experiences}
    src_exp_dates = {
        (_norm(e.company), _norm(e.start_date), _norm(e.end_date), e.current)
        for e in source.experiences
    }

    for exp in generated.experiences:
        if _norm(exp.company) not in src_companies:
            violations.append(f"Invented employer: '{exp.company}'.")
            continue
        if (_norm(exp.company), _norm(exp.title)) not in src_exp_pairs:
            violations.append(f"Changed job title at '{exp.company}': '{exp.title}'.")
        if (
            _norm(exp.company),
            _norm(exp.start_date),
            _norm(exp.end_date),
            exp.current,
        ) not in src_exp_dates:
            violations.append(f"Changed dates for experience at '{exp.company}'.")

    src_projects = {_norm(p.name) for p in source.projects}
    for project in generated.projects:
        if _norm(project.name) not in src_projects:
            violations.append(f"Invented project: '{project.name}'.")

    src_institutions = {_norm(e.institution) for e in source.education}
    for edu in generated.education:
        if _norm(edu.institution) not in src_institutions:
            violations.append(f"Invented institution: '{edu.institution}'.")

    src_skills = {_norm(s) for s in source.skills}
    for skill in generated.skills:
        if _norm(skill) not in src_skills:
            violations.append(f"Added skill not in source resume: '{skill}'.")

    # Fabricated metrics: any number in a generated bullet must already exist
    # somewhere in the source resume's text.
    src_numbers = set(re.findall(r"\d[\d,.]*", _source_text(source)))
    for bullet in _all_bullets(generated):
        for number in re.findall(r"\d[\d,.]*", bullet):
            if number not in src_numbers:
                violations.append(f"Invented metric '{number}' in bullet: '{bullet[:80]}…'.")
                break

    return violations


def _all_bullets(resume: ParsedResume) -> list[str]:
    bullets = [b for e in resume.experiences for b in e.bullets]
    bullets += [b for p in resume.projects for b in p.bullets]
    return bullets


def _source_text(resume: ParsedResume) -> str:
    parts = [resume.summary]
    for e in resume.experiences:
        parts.extend(e.bullets)
        parts.extend([e.start_date, e.end_date])
    for p in resume.projects:
        parts.append(p.description)
        parts.extend(p.bullets)
    for edu in resume.education:
        parts.extend([edu.gpa, edu.start_date, edu.end_date])
        parts.extend(edu.highlights)
    return " ".join(parts)
