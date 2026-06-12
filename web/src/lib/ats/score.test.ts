import { describe, expect, it } from "vitest";

import { ATS_WEIGHTS, computeAtsScore, resumeToPlainText } from "@/lib/ats/score";
import type { JobAnalysis, ParsedResume } from "@/lib/schemas";

const resume: ParsedResume = {
  contact: {
    name: "Sam Carter",
    email: "sam@example.com",
    phone: "555-123-4567",
    location: "Calgary, AB",
    links: ["github.com/samcarter"],
  },
  summary: "Backend developer focused on REST APIs.",
  education: [
    {
      institution: "University of Calgary",
      degree: "BSc",
      field: "Computer Science",
      startDate: "2022",
      endDate: "2026",
      gpa: "3.7",
      highlights: [],
    },
  ],
  skills: ["Python", "PostgreSQL", "Docker", "FastAPI"],
  experiences: [
    {
      company: "Acme Corp",
      title: "Software Developer Intern",
      location: "Calgary, AB",
      startDate: "May 2024",
      endDate: "Aug 2024",
      current: false,
      bullets: ["Built REST endpoints in Python with FastAPI", "Deployed with Docker"],
    },
  ],
  projects: [
    {
      name: "Fraud Detector",
      description: "ML pipeline",
      technologies: ["Python"],
      url: "",
      bullets: ["Trained a model on PostgreSQL-stored data"],
    },
  ],
};

// Indexing is checked (noUncheckedIndexedAccess); the fixture always has one.
const firstExperience = resume.experiences[0]!;

const job: JobAnalysis = {
  title: "Backend Intern",
  company: "TechCo",
  seniority: "internship",
  requiredSkills: ["Python", "PostgreSQL"],
  preferredSkills: ["Docker"],
  technologies: ["FastAPI"],
  keywords: ["REST", "Python", "Docker"],
  softSkills: [],
  responsibilities: [],
};

describe("resumeToPlainText", () => {
  it("renders every section with ATS-standard headings", () => {
    const text = resumeToPlainText(resume);
    expect(text).toContain("Sam Carter");
    expect(text).toContain("SUMMARY");
    expect(text).toContain("SKILLS");
    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("PROJECTS");
    expect(text).toContain("EDUCATION");
    expect(text).toContain("• Built REST endpoints in Python with FastAPI");
  });

  it("renders 'Present' for current roles", () => {
    const current: ParsedResume = {
      ...resume,
      experiences: [{ ...firstExperience, current: true, endDate: "" }],
    };
    expect(resumeToPlainText(current)).toContain("May 2024 – Present");
  });

  it("omits empty sections entirely", () => {
    const minimal: ParsedResume = {
      ...resume,
      summary: "",
      skills: [],
      projects: [],
      education: [],
    };
    const text = resumeToPlainText(minimal);
    expect(text).not.toContain("SUMMARY");
    expect(text).not.toContain("SKILLS");
    expect(text).not.toContain("PROJECTS");
    expect(text).not.toContain("EDUCATION");
  });
});

describe("computeAtsScore", () => {
  it("gives full keyword and skills credit when everything matches", () => {
    const { breakdown } = computeAtsScore({
      content: resume,
      job,
      includedExperienceScores: [{ score: 100 }],
      includedProjectScores: [{ score: 100 }],
    });
    expect(breakdown.keywordMatch.score).toBe(ATS_WEIGHTS.keywordMatch);
    expect(breakdown.skillsMatch.score).toBe(ATS_WEIGHTS.skillsMatch);
    expect(breakdown.experienceMatch.score).toBe(ATS_WEIGHTS.experienceMatch);
    expect(breakdown.projectMatch.score).toBe(ATS_WEIGHTS.projectMatch);
  });

  it("treats an undemanding job as fully matched, not as zero", () => {
    const { breakdown } = computeAtsScore({
      content: resume,
      job: { ...job, keywords: [], requiredSkills: [], preferredSkills: [], technologies: [] },
      includedExperienceScores: [{ score: 50 }],
      includedProjectScores: [],
    });
    expect(breakdown.keywordMatch.score).toBe(ATS_WEIGHTS.keywordMatch);
    expect(breakdown.skillsMatch.score).toBe(ATS_WEIGHTS.skillsMatch);
  });

  it("averages relevance scores for the experience component", () => {
    const { breakdown } = computeAtsScore({
      content: resume,
      job,
      includedExperienceScores: [{ score: 100 }, { score: 0 }],
      includedProjectScores: [],
    });
    expect(breakdown.experienceMatch.score).toBe(ATS_WEIGHTS.experienceMatch / 2);
    expect(breakdown.projectMatch.score).toBe(0);
  });

  it("penalizes formatting violations and names them", () => {
    const sloppy: ParsedResume = {
      ...resume,
      contact: { ...resume.contact, email: "not-an-email", phone: "" },
      experiences: [
        {
          ...firstExperience,
          bullets: ["I personally did everything on my team and my manager loved it"],
        },
      ],
    };
    const { breakdown } = computeAtsScore({
      content: sloppy,
      job,
      includedExperienceScores: [{ score: 100 }],
      includedProjectScores: [],
    });
    expect(breakdown.formatting.score).toBeLessThan(ATS_WEIGHTS.formatting);
    expect(breakdown.formatting.detail).toContain("contact email");
    expect(breakdown.formatting.detail).toContain("first-person");
  });

  it("never exceeds 100 in total", () => {
    const { total } = computeAtsScore({
      content: resume,
      job,
      includedExperienceScores: [{ score: 100 }],
      includedProjectScores: [{ score: 100 }],
    });
    expect(total).toBeLessThanOrEqual(100);
    expect(total).toBeGreaterThan(0);
  });
});
