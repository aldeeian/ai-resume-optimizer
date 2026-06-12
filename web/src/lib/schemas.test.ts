import { describe, expect, it } from "vitest";

import {
  bulletEvidenceSchema,
  generateResponseSchema,
  interviewFeedbackSchema,
  parsedResumeSchema,
  startInterviewInputSchema,
  submitInterviewAnswerSchema,
} from "@/lib/schemas";

describe("parsedResumeSchema", () => {
  it("fills every section with safe defaults", () => {
    const parsed = parsedResumeSchema.parse({ contact: {} });
    expect(parsed.summary).toBe("");
    expect(parsed.skills).toEqual([]);
    expect(parsed.experiences).toEqual([]);
    expect(parsed.contact.links).toEqual([]);
  });
});

describe("generateResponseSchema", () => {
  it("tolerates responses without evidence (older service versions)", () => {
    const parsed = generateResponseSchema.parse({ content: { contact: {} } });
    expect(parsed.evidence).toEqual([]);
  });

  it("parses evidence entries with defaults", () => {
    const evidence = bulletEvidenceSchema.parse({ section: "experience", sources: ["quote"] });
    expect(evidence.entryIndex).toBe(0);
    expect(evidence.verified).toBe(false);
  });

  it("rejects unknown evidence sections", () => {
    expect(() => bulletEvidenceSchema.parse({ section: "hobbies" })).toThrow();
  });
});

describe("interviewFeedbackSchema", () => {
  it("bounds the score to 0-100", () => {
    expect(() => interviewFeedbackSchema.parse({ score: 101 })).toThrow();
    expect(interviewFeedbackSchema.parse({ score: 88 }).star).toBeNull();
  });
});

describe("startInterviewInputSchema", () => {
  it("accepts a generated resume alone", () => {
    expect(startInterviewInputSchema.safeParse({ generatedResumeId: "g1" }).success).toBe(true);
  });

  it("accepts a job + resume pair", () => {
    const result = startInterviewInputSchema.safeParse({
      jobDescriptionId: "j1",
      resumeId: "r1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.numQuestions).toBe(6);
  });

  it("rejects a job without a resume (and vice versa)", () => {
    expect(startInterviewInputSchema.safeParse({ jobDescriptionId: "j1" }).success).toBe(false);
    expect(startInterviewInputSchema.safeParse({ resumeId: "r1" }).success).toBe(false);
    expect(startInterviewInputSchema.safeParse({}).success).toBe(false);
  });

  it("bounds the question count", () => {
    expect(
      startInterviewInputSchema.safeParse({ generatedResumeId: "g1", numQuestions: 2 }).success
    ).toBe(false);
    expect(
      startInterviewInputSchema.safeParse({ generatedResumeId: "g1", numQuestions: 11 }).success
    ).toBe(false);
  });
});

describe("submitInterviewAnswerSchema", () => {
  it("rejects one-word answers", () => {
    const result = submitInterviewAnswerSchema.safeParse({
      sessionId: "s1",
      questionId: "q1",
      answer: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("trims and accepts a real answer", () => {
    const result = submitInterviewAnswerSchema.safeParse({
      sessionId: "s1",
      questionId: "q1",
      answer: "  In my internship at Acme I led the migration to FastAPI.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.answer.startsWith("In my")).toBe(true);
  });
});
