"""Post-generation truthfulness validation.

Cross-checks every load-bearing fact in the generated resume against the
source resume. The generator is prompt-constrained, but prompts are not
guarantees — this is the enforcement layer.
"""

import re

from app.schemas import BulletEvidence, ParsedResume


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def strip_invented_skills(source: ParsedResume, generated: ParsedResume) -> ParsedResume:
    """Remove any skills the model invented that aren't in the source resume."""
    src_skills = {_norm(s) for s in source.skills}
    allowed = [s for s in generated.skills if _norm(s) in src_skills]
    return generated.model_copy(update={"skills": allowed})


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


def validate_letter_numbers(source: ParsedResume, letter: str) -> list[str]:
    """Cover letter check: every figure in the letter must exist in the resume.

    Small word-counts the model naturally writes ("two projects") are not
    digits, so this only catches fabricated metrics like "$2M" or "40%".
    """
    src_numbers = set(re.findall(r"\d[\d,.]*", _source_text(source)))
    violations: list[str] = []
    for number in re.findall(r"\d[\d,.]*", letter):
        if number not in src_numbers:
            violations.append(f"Invented figure '{number}' in the letter.")
    return violations


# ── Evidence verification ────────────────────────────────────────────────────

# A quote shorter than this (normalized) is too weak to count as provenance.
MIN_QUOTE_LENGTH = 10


def verify_evidence(
    source: ParsedResume,
    generated: ParsedResume,
    evidence: list[BulletEvidence],
) -> tuple[list[BulletEvidence], list[str]]:
    """Deterministically verify the model's claimed provenance.

    A quote counts only if it appears verbatim (whitespace/case-insensitive)
    in the source resume. Returns the evidence list with `verified` set, plus
    human-readable refs for generated bullets that ended up with no verified
    evidence (used to drive a corrective retry).
    """
    haystack = _norm(_source_text(source) + " " + " ".join(source.skills))

    covered: set[tuple[str, int, int]] = set()
    checked: list[BulletEvidence] = []
    for item in evidence:
        if not _evidence_target_exists(generated, item):
            continue  # points at nothing — drop it
        verified_sources = [
            q for q in item.sources if len(_norm(q)) >= MIN_QUOTE_LENGTH and _norm(q) in haystack
        ]
        verified = len(verified_sources) > 0
        checked.append(
            BulletEvidence(
                section=item.section,
                entry_index=item.entry_index,
                bullet_index=item.bullet_index,
                sources=verified_sources if verified else item.sources,
                verified=verified,
            )
        )
        if verified:
            covered.add((item.section, item.entry_index, item.bullet_index))

    uncovered: list[str] = []
    if generated.summary and ("summary", 0, 0) not in covered:
        uncovered.append("summary")
    for i, exp in enumerate(generated.experiences):
        for j, bullet in enumerate(exp.bullets):
            if ("experience", i, j) not in covered:
                uncovered.append(
                    f"experience[{i}] '{exp.company}' bullet {j + 1}: '{bullet[:60]}…'"
                )
    for i, project in enumerate(generated.projects):
        for j, bullet in enumerate(project.bullets):
            if ("project", i, j) not in covered:
                uncovered.append(f"project[{i}] '{project.name}' bullet {j + 1}: '{bullet[:60]}…'")

    return checked, uncovered


def _evidence_target_exists(generated: ParsedResume, item: BulletEvidence) -> bool:
    if item.section == "summary":
        return bool(generated.summary)
    entries = generated.experiences if item.section == "experience" else generated.projects
    if item.entry_index >= len(entries):
        return False
    return item.bullet_index < len(entries[item.entry_index].bullets)


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
