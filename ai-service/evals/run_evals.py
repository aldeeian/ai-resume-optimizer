"""Live LLM eval harness for the ai-service pipeline.

Runs the golden cases through the real parse → generate pipeline (actual
Anthropic API calls) and scores the outputs against expected facts:

  parse   — name/company/institution/project exactness, skill recall
  generate — truthfulness (enforced by the endpoint) and evidence coverage
             (fraction of generated bullets with verified source quotes)

Usage (requires ANTHROPIC_API_KEY; AI_SERVICE_API_KEY may be any value):

    cd ai-service
    python -m evals.run_evals

Exits non-zero when any metric falls below its threshold, so it can run as
a manually-triggered CI job. Deterministic unit tests live in tests/; this
harness measures model-quality drift, which unit tests cannot.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("AI_SERVICE_API_KEY", "eval-run")

from app.main import generate, parse_resume  # noqa: E402
from app.schemas import (  # noqa: E402
    GenerateRequest,
    JobAnalysis,
    ParsedResume,
    RawTextRequest,
)

SKILL_RECALL_THRESHOLD = 0.8
EVIDENCE_COVERAGE_THRESHOLD = 0.6

GOLDEN = Path(__file__).parent / "golden" / "cases.json"


def _norm(value: str) -> str:
    return " ".join(value.lower().split())


def _norm_set(values: list[str]) -> set[str]:
    return {_norm(v) for v in values}


def score_parse(parsed: ParsedResume, expected: dict) -> list[str]:
    """Return a list of failures (empty = pass)."""
    failures: list[str] = []

    if _norm(parsed.contact.name) != _norm(expected["name"]):
        failures.append(f"name: got '{parsed.contact.name}', want '{expected['name']}'")

    got_companies = _norm_set([e.company for e in parsed.experiences])
    if got_companies != _norm_set(expected["companies"]):
        failures.append(f"companies: got {sorted(got_companies)}")

    got_institutions = _norm_set([e.institution for e in parsed.education])
    if got_institutions != _norm_set(expected["institutions"]):
        failures.append(f"institutions: got {sorted(got_institutions)}")

    got_projects = _norm_set([p.name for p in parsed.projects])
    if not _norm_set(expected["project_names"]) <= got_projects:
        failures.append(f"projects: got {sorted(got_projects)}")

    want_skills = _norm_set(expected["skills"])
    got_skills = _norm_set(parsed.skills)
    recall = len(want_skills & got_skills) / len(want_skills)
    if recall < SKILL_RECALL_THRESHOLD:
        failures.append(
            f"skill recall {recall:.2f} < {SKILL_RECALL_THRESHOLD} "
            f"(missing: {sorted(want_skills - got_skills)})"
        )

    return failures


async def run_case(case: dict) -> bool:
    name = case["name"]
    print(f"\n── {name} " + "─" * max(0, 60 - len(name)))

    parsed = await parse_resume(RawTextRequest(raw_text=case["resume_text"]))
    parse_failures = score_parse(parsed, case["expected"])
    for failure in parse_failures:
        print(f"  ✗ parse: {failure}")
    if not parse_failures:
        print("  ✓ parse: all facts extracted correctly")

    job = JobAnalysis.model_validate(case["job"])
    generated = await generate(GenerateRequest(job=job, resume=parsed))

    total = len(generated.evidence)
    verified = sum(1 for e in generated.evidence if e.verified)
    coverage = verified / total if total else 0.0
    generate_ok = coverage >= EVIDENCE_COVERAGE_THRESHOLD
    marker = "✓" if generate_ok else "✗"
    print(
        f"  {marker} generate: truthfulness enforced; evidence coverage "
        f"{verified}/{total} ({coverage:.0%}, threshold {EVIDENCE_COVERAGE_THRESHOLD:.0%})"
    )

    return not parse_failures and generate_ok


async def main() -> int:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY is not set — cannot run live evals.", file=sys.stderr)
        return 2

    cases = json.loads(GOLDEN.read_text())
    results = [await run_case(case) for case in cases]

    passed = sum(results)
    print(f"\n{passed}/{len(results)} cases passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
