import json
import logging

from fastapi import Depends, FastAPI, HTTPException, status

from app.llm import call_structured
from app.prompts import (
    ANALYZE_JOB_SYSTEM,
    COVER_LETTER_SYSTEM,
    GENERATE_SYSTEM,
    INTERVIEW_FEEDBACK_SYSTEM,
    INTERVIEW_QUESTIONS_SYSTEM,
    PARSE_RESUME_SYSTEM,
    RANK_SYSTEM,
)
from app.schemas import (
    CoverLetterDraft,
    CoverLetterRequest,
    CoverLetterResponse,
    ExperienceRankItem,
    GeneratedWithEvidence,
    GenerateRequest,
    GenerateResponse,
    InterviewFeedback,
    InterviewFeedbackRequest,
    InterviewQuestion,
    InterviewQuestionsDraft,
    InterviewQuestionsRequest,
    InterviewQuestionsResponse,
    JobAnalysis,
    ParsedResume,
    ProjectRankItem,
    RankRequest,
    RankResponse,
    RawTextRequest,
)
from app.security import require_api_key
from app.truthfulness import (
    validate_generated_resume,
    validate_letter_numbers,
    verify_evidence,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Resume Optimizer — AI Service",
    version="1.0.0",
    description="Internal LLM microservice: resume parsing, job analysis, ranking, generation.",
)


def _dump(model: "object") -> str:
    """Serialize a pydantic model to indented camelCase JSON for prompts."""
    return json.dumps(model.model_dump(by_alias=True), indent=2)  # type: ignore[attr-defined]


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
        f"<job_analysis>\n{_dump(req.job)}\n</job_analysis>\n\n"
        f"<source_resume>\n{_dump(req.resume)}\n</source_resume>"
    )

    generated = await call_structured(
        system=GENERATE_SYSTEM,
        user_content=user_content,
        tool_name="save_tailored_resume",
        tool_description="Save the tailored, truthful, ATS-optimized resume with evidence.",
        output_model=GeneratedWithEvidence,
    )

    violations = validate_generated_resume(req.resume, generated.content)
    evidence, uncovered = verify_evidence(req.resume, generated.content, generated.evidence)
    if violations or uncovered:
        logger.warning(
            "Retrying generation: %d truthfulness violations, %d bullets without evidence",
            len(violations),
            len(uncovered),
        )
        # One corrective retry with the specific problems called out.
        problems: list[str] = []
        if violations:
            problems.append(
                "Truthfulness violations:\n- " + "\n- ".join(violations[:20])
                + "\nCopy companies, titles, dates, institutions, skills, and metrics "
                "EXACTLY from the source resume."
            )
        if uncovered:
            problems.append(
                "These parts had no valid evidence (quotes must be VERBATIM from the "
                "source resume):\n- " + "\n- ".join(uncovered[:20])
            )
        generated = await call_structured(
            system=GENERATE_SYSTEM,
            user_content=(
                user_content
                + "\n\nYour previous attempt had these problems:\n\n"
                + "\n\n".join(problems)
                + "\n\nRegenerate the resume fixing every problem."
            ),
            tool_name="save_tailored_resume",
            tool_description="Save the tailored, truthful, ATS-optimized resume with evidence.",
            output_model=GeneratedWithEvidence,
        )
        violations = validate_generated_resume(req.resume, generated.content)
        if violations:
            logger.error("Truthfulness violations after retry: %s", violations)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Generation produced unverifiable content and was rejected: "
                + "; ".join(violations[:5]),
            )
        evidence, uncovered = verify_evidence(req.resume, generated.content, generated.evidence)
        if uncovered:
            # Truthful but not fully cited — ship it with honest verified=false flags.
            logger.warning("%d bullets still lack verified evidence after retry", len(uncovered))

    return GenerateResponse(content=generated.content, evidence=evidence)


@app.post(
    "/api/v1/cover-letter",
    response_model=CoverLetterResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def cover_letter(req: CoverLetterRequest) -> CoverLetterResponse:
    """Job analysis + resume → tailored, truthful cover letter."""
    if not req.resume.experiences and not req.resume.projects:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The resume has no experiences or projects to write about.",
        )

    user_content = (
        f"Write a {req.tone} cover letter for this candidate and job.\n\n"
        f"<job_analysis>\n{_dump(req.job)}\n</job_analysis>\n\n"
        f"<resume>\n{_dump(req.resume)}\n</resume>"
    )

    draft = await call_structured(
        system=COVER_LETTER_SYSTEM,
        user_content=user_content,
        tool_name="save_cover_letter",
        tool_description="Save the tailored, truthful cover letter.",
        output_model=CoverLetterDraft,
    )

    violations = validate_letter_numbers(req.resume, draft.content)
    if violations:
        logger.warning("Cover letter invented metrics, retrying once: %s", violations)
        draft = await call_structured(
            system=COVER_LETTER_SYSTEM,
            user_content=(
                user_content
                + "\n\nYour previous attempt invented numbers that are not in the resume:\n- "
                + "\n- ".join(violations[:10])
                + "\nRewrite the letter using only facts and figures from the resume."
            ),
            tool_name="save_cover_letter",
            tool_description="Save the tailored, truthful cover letter.",
            output_model=CoverLetterDraft,
        )
        violations = validate_letter_numbers(req.resume, draft.content)
        if violations:
            logger.error("Cover letter still invented metrics: %s", violations)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The letter contained unverifiable figures and was rejected.",
            )

    return CoverLetterResponse(content=draft.content)


@app.post(
    "/api/v1/interview/questions",
    response_model=InterviewQuestionsResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def interview_questions(req: InterviewQuestionsRequest) -> InterviewQuestionsResponse:
    """Job analysis + resume → tailored mock interview question set."""
    draft = await call_structured(
        system=INTERVIEW_QUESTIONS_SYSTEM,
        user_content=(
            f"Prepare exactly {req.num_questions} interview questions.\n\n"
            f"<job_analysis>\n{_dump(req.job)}\n</job_analysis>\n\n"
            f"<resume>\n{_dump(req.resume)}\n</resume>"
        ),
        tool_name="save_interview_questions",
        tool_description="Save the tailored interview question set.",
        output_model=InterviewQuestionsDraft,
    )

    if not draft.questions:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The model returned no interview questions.",
        )

    # Server assigns stable ids; never trust the model for identity.
    questions = [
        InterviewQuestion(
            id=f"q{i + 1}",
            type=q.type,
            question=q.question,
            focus_area=q.focus_area,
        )
        for i, q in enumerate(draft.questions[: req.num_questions])
    ]
    return InterviewQuestionsResponse(questions=questions)


@app.post(
    "/api/v1/interview/feedback",
    response_model=InterviewFeedback,
    response_model_by_alias=True,
    dependencies=[Depends(require_api_key)],
)
async def interview_feedback(req: InterviewFeedbackRequest) -> InterviewFeedback:
    """Score one interview answer with structured coaching feedback."""
    parts = [
        f"<job_analysis>\n{_dump(req.job)}\n</job_analysis>",
        f"<question>\n{_dump(req.question)}\n</question>",
        f"<answer>\n{req.answer}\n</answer>",
    ]
    if req.resume is not None:
        parts.append(
            f"<resume>\n{_dump(req.resume)}\n</resume>"
        )

    feedback = await call_structured(
        system=INTERVIEW_FEEDBACK_SYSTEM,
        user_content="Score this interview answer.\n\n" + "\n\n".join(parts),
        tool_name="save_answer_feedback",
        tool_description="Save the structured feedback for this interview answer.",
        output_model=InterviewFeedback,
    )

    # STAR analysis only makes sense for behavioral questions.
    if req.question.type != "behavioral":
        feedback.star = None
    return feedback
