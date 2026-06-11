import json
import logging

from fastapi import Depends, FastAPI, HTTPException, status

from app.claude import call_structured
from app.prompts import (
    ANALYZE_JOB_SYSTEM,
    GENERATE_SYSTEM,
    PARSE_RESUME_SYSTEM,
    RANK_SYSTEM,
)
from app.schemas import (
    ExperienceRankItem,
    GenerateRequest,
    GenerateResponse,
    JobAnalysis,
    ParsedResume,
    ProjectRankItem,
    RankRequest,
    RankResponse,
    RawTextRequest,
)
from app.security import require_api_key
from app.truthfulness import validate_generated_resume

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Resume Optimizer — AI Service",
    version="1.0.0",
    description="Internal LLM microservice: resume parsing, job analysis, ranking, generation.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/v1/resume/parse",
    response_model=ParsedResume,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def parse_resume(req: RawTextRequest) -> ParsedResume:
    """Raw resume text → structured resume."""
    return await call_structured(
        system=PARSE_RESUME_SYSTEM,
        user_content=f"Parse this resume:\n\n<resume>\n{req.raw_text}\n</resume>",
        tool_name="save_parsed_resume",
        tool_description="Save the structured content extracted from the resume.",
        output_model=ParsedResume,
    )


@app.post(
    "/api/v1/job/analyze",
    response_model=JobAnalysis,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def analyze_job(req: RawTextRequest) -> JobAnalysis:
    """Raw job posting text → structured job analysis."""
    return await call_structured(
        system=ANALYZE_JOB_SYSTEM,
        user_content=f"Analyze this job posting:\n\n<job_posting>\n{req.raw_text}\n</job_posting>",
        tool_name="save_job_analysis",
        tool_description="Save the structured analysis of the job posting.",
        output_model=JobAnalysis,
    )


@app.post(
    "/api/v1/rank",
    response_model=RankResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def rank(req: RankRequest) -> RankResponse:
    """Score every experience and project against the job."""
    if not req.experiences and not req.projects:
        return RankResponse()

    payload = {
        "job": req.job.model_dump(by_alias=True),
        "experiences": [e.model_dump(by_alias=True) for e in req.experiences],
        "projects": [p.model_dump(by_alias=True) for p in req.projects],
    }
    result = await call_structured(
        system=RANK_SYSTEM,
        user_content=(
            "Score every experience and project against the job.\n\n"
            f"<data>\n{json.dumps(payload, indent=2)}\n</data>"
        ),
        tool_name="save_rankings",
        tool_description="Save the relevance scores for all experiences and projects.",
        output_model=RankResponse,
    )

    # The model must account for every item; default any it skipped to 0.
    scored_exp = {item.id for item in result.experiences}
    for exp in req.experiences:
        if exp.id not in scored_exp:
            result.experiences.append(
                ExperienceRankItem(id=exp.id, score=0, reasoning="Not scored by the model.")
            )
    scored_proj = {item.id for item in result.projects}
    for project in req.projects:
        if project.id not in scored_proj:
            result.projects.append(ProjectRankItem(id=project.id, score=0))
    return result


@app.post(
    "/api/v1/generate",
    response_model=GenerateResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """Rewrite the (already selected) resume content for the target job."""
    if not req.resume.experiences and not req.resume.projects:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The resume has no experiences or projects to tailor.",
        )

    user_content = (
        "Tailor this resume to this job.\n\n"
        f"<job_analysis>\n{json.dumps(req.job.model_dump(by_alias=True), indent=2)}\n</job_analysis>\n\n"
        f"<source_resume>\n{json.dumps(req.resume.model_dump(by_alias=True), indent=2)}\n</source_resume>"
    )

    generated = await call_structured(
        system=GENERATE_SYSTEM,
        user_content=user_content,
        tool_name="save_tailored_resume",
        tool_description="Save the tailored, truthful, ATS-optimized resume.",
        output_model=ParsedResume,
    )

    violations = validate_generated_resume(req.resume, generated)
    if violations:
        logger.warning("Truthfulness violations, retrying once: %s", violations)
        # One corrective retry with the specific violations called out.
        generated = await call_structured(
            system=GENERATE_SYSTEM,
            user_content=(
                user_content
                + "\n\nYour previous attempt violated the truthfulness constraints:\n- "
                + "\n- ".join(violations[:20])
                + "\nRegenerate the resume fixing every violation. Copy companies, titles, "
                "dates, institutions, skills, and metrics EXACTLY from the source resume."
            ),
            tool_name="save_tailored_resume",
            tool_description="Save the tailored, truthful, ATS-optimized resume.",
            output_model=ParsedResume,
        )
        violations = validate_generated_resume(req.resume, generated)
        if violations:
            logger.error("Truthfulness violations after retry: %s", violations)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Generation produced unverifiable content and was rejected: "
                + "; ".join(violations[:5]),
            )

    return GenerateResponse(content=generated)
