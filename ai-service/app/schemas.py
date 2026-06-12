"""Pydantic models shared by all endpoints.

The wire format is camelCase (matching the TypeScript Zod schemas in the web
app); Python attribute names stay snake_case via the alias generator.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


# ── Resume structures ────────────────────────────────────────────────────────


class ContactInfo(CamelModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: list[str] = Field(default_factory=list)


class EducationEntry(CamelModel):
    institution: str = ""
    degree: str = ""
    field: str = ""
    start_date: str = ""
    end_date: str = ""
    gpa: str = ""
    highlights: list[str] = Field(default_factory=list)


class ExperienceEntry(CamelModel):
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    current: bool = False
    bullets: list[str] = Field(default_factory=list)


class ProjectEntry(CamelModel):
    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    url: str = ""
    bullets: list[str] = Field(default_factory=list)


class ParsedResume(CamelModel):
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: str = ""
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    experiences: list[ExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)


# ── Job analysis ─────────────────────────────────────────────────────────────


class JobAnalysis(CamelModel):
    title: str = "Untitled role"
    company: str = "Unknown company"
    seniority: str = ""
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)


# ── Ranking ──────────────────────────────────────────────────────────────────


class RankExperienceInput(CamelModel):
    id: str
    company: str = ""
    title: str = ""
    bullets: list[str] = Field(default_factory=list)


class RankProjectInput(CamelModel):
    id: str
    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class ExperienceRankItem(CamelModel):
    id: str
    score: int = Field(ge=0, le=100)
    reasoning: str = ""
    matched_skills: list[str] = Field(default_factory=list)


class ProjectRankItem(CamelModel):
    id: str
    score: int = Field(ge=0, le=100)
    matched_technologies: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)


class RankResponse(CamelModel):
    experiences: list[ExperienceRankItem] = Field(default_factory=list)
    projects: list[ProjectRankItem] = Field(default_factory=list)


# ── Evidence (bullet provenance) ─────────────────────────────────────────────


class BulletEvidence(CamelModel):
    """Provenance for one generated bullet (or the summary).

    `sources` are verbatim quotes from the source resume that justify the
    generated text. `verified` is set server-side by deterministic substring
    matching — the model never decides its own trustworthiness.
    """

    section: Literal["summary", "experience", "project"]
    entry_index: int = Field(default=0, ge=0)
    bullet_index: int = Field(default=0, ge=0)
    sources: list[str] = Field(default_factory=list)
    verified: bool = False


class GeneratedWithEvidence(CamelModel):
    """Tool output contract for /generate: tailored content plus provenance."""

    content: ParsedResume
    evidence: list[BulletEvidence] = Field(default_factory=list)


# ── Cover letter ─────────────────────────────────────────────────────────────


class CoverLetterRequest(CamelModel):
    job: JobAnalysis
    resume: ParsedResume
    tone: Literal["professional", "enthusiastic", "concise"] = "professional"


class CoverLetterDraft(CamelModel):
    """Tool output contract for cover letter generation."""

    content: str = Field(min_length=200)


class CoverLetterResponse(CamelModel):
    content: str


# ── Mock interview ───────────────────────────────────────────────────────────


class InterviewQuestionDraft(CamelModel):
    """Tool output contract: the model proposes questions, the server ids them."""

    type: Literal["behavioral", "technical", "resume"]
    question: str
    focus_area: str = ""


class InterviewQuestionsDraft(CamelModel):
    questions: list[InterviewQuestionDraft] = Field(default_factory=list)


class InterviewQuestion(CamelModel):
    id: str
    type: Literal["behavioral", "technical", "resume"]
    question: str
    focus_area: str = ""


class InterviewQuestionsRequest(CamelModel):
    job: JobAnalysis
    resume: ParsedResume
    num_questions: int = Field(default=6, ge=3, le=10)


class InterviewQuestionsResponse(CamelModel):
    questions: list[InterviewQuestion] = Field(default_factory=list)


class StarAnalysis(CamelModel):
    """STAR-method coverage of a behavioral answer."""

    situation: bool = False
    task: bool = False
    action: bool = False
    result: bool = False
    note: str = ""


class InterviewFeedbackRequest(CamelModel):
    job: JobAnalysis
    question: InterviewQuestion
    answer: str = Field(min_length=20, max_length=10_000)
    resume: ParsedResume | None = None


class InterviewFeedback(CamelModel):
    score: int = Field(ge=0, le=100)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    star: StarAnalysis | None = None
    example_answer: str = ""


# ── Requests / responses ─────────────────────────────────────────────────────


class RawTextRequest(CamelModel):
    raw_text: str = Field(min_length=50, max_length=100_000)


class RankRequest(CamelModel):
    job: JobAnalysis
    experiences: list[RankExperienceInput] = Field(default_factory=list)
    projects: list[RankProjectInput] = Field(default_factory=list)


class GenerateRequest(CamelModel):
    job: JobAnalysis
    resume: ParsedResume


class GenerateResponse(CamelModel):
    content: ParsedResume
    evidence: list[BulletEvidence] = Field(default_factory=list)
