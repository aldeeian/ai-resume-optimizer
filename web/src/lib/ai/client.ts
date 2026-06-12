import "server-only";

import { z } from "zod";

import {
  coverLetterResponseSchema,
  generateResponseSchema,
  interviewFeedbackSchema,
  interviewQuestionsResponseSchema,
  jobAnalysisSchema,
  parsedResumeSchema,
  rankResponseSchema,
  type BulletEvidence,
  type CoverLetterTone,
  type InterviewFeedback,
  type InterviewQuestion,
  type JobAnalysis,
  type ParsedResume,
  type RankResponse,
} from "@/lib/schemas";

/**
 * Typed HTTP client for the FastAPI ai-service.
 *
 * Every call: shared-secret auth header, request timeout, single retry on
 * 5xx/network failure, and Zod validation of the response payload — a
 * malformed model output can never propagate into the database.
 */

const DEFAULT_TIMEOUT_MS = 60_000;
const GENERATE_TIMEOUT_MS = 180_000;

class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

function serviceConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.AI_SERVICE_URL;
  const apiKey = process.env.AI_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new AiServiceError(
      "AI service is not configured. Set AI_SERVICE_URL and AI_SERVICE_API_KEY."
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function postJson<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  timeoutMs: number
): Promise<T> {
  const { baseUrl, apiKey } = serviceConfig();
  const url = `${baseUrl}${path}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        let detail = `AI service responded with ${res.status}.`;
        try {
          const problem = (await res.json()) as { detail?: string };
          if (problem.detail) detail = problem.detail;
        } catch {
          // non-JSON error body — keep the status message
        }
        // Retry only on server-side failures; 4xx are deterministic.
        if (res.status >= 500 && attempt === 0) {
          lastError = new AiServiceError(detail, res.status);
          continue;
        }
        throw new AiServiceError(detail, res.status);
      }

      const json: unknown = await res.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new AiServiceError("AI service returned an unexpected response shape.");
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof AiServiceError) throw err;
      // AbortError / network error — retry once.
      lastError = err;
      if (attempt === 0) continue;
      throw new AiServiceError(
        "Could not reach the AI service. Please try again in a moment."
      );
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AiServiceError("AI service request failed.");
}

export async function parseResumeText(rawText: string): Promise<ParsedResume> {
  return postJson("/api/v1/resume/parse", { rawText }, parsedResumeSchema, DEFAULT_TIMEOUT_MS);
}

export async function analyzeJobText(rawText: string): Promise<JobAnalysis> {
  return postJson("/api/v1/job/analyze", { rawText }, jobAnalysisSchema, DEFAULT_TIMEOUT_MS);
}

export interface RankRequestExperience {
  id: string;
  company: string;
  title: string;
  bullets: string[];
}

export interface RankRequestProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
}

export async function rankAgainstJob(input: {
  job: JobAnalysis;
  experiences: RankRequestExperience[];
  projects: RankRequestProject[];
}): Promise<RankResponse> {
  return postJson("/api/v1/rank", input, rankResponseSchema, DEFAULT_TIMEOUT_MS);
}

/**
 * `resume` must already be filtered to the selected experiences/projects in
 * ranked order — the service rewrites, it does not select.
 */
export async function generateTailoredResume(input: {
  job: JobAnalysis;
  resume: ParsedResume;
}): Promise<{ content: ParsedResume; evidence: BulletEvidence[] }> {
  return postJson("/api/v1/generate", input, generateResponseSchema, GENERATE_TIMEOUT_MS);
}

export async function generateCoverLetterText(input: {
  job: JobAnalysis;
  resume: ParsedResume;
  tone: CoverLetterTone;
}): Promise<string> {
  const res = await postJson(
    "/api/v1/cover-letter",
    input,
    coverLetterResponseSchema,
    GENERATE_TIMEOUT_MS
  );
  return res.content;
}

export async function fetchInterviewQuestions(input: {
  job: JobAnalysis;
  resume: ParsedResume;
  numQuestions: number;
}): Promise<InterviewQuestion[]> {
  const res = await postJson(
    "/api/v1/interview/questions",
    input,
    interviewQuestionsResponseSchema,
    GENERATE_TIMEOUT_MS
  );
  return res.questions;
}

export async function fetchInterviewFeedback(input: {
  job: JobAnalysis;
  question: InterviewQuestion;
  answer: string;
  resume?: ParsedResume;
}): Promise<InterviewFeedback> {
  return postJson(
    "/api/v1/interview/feedback",
    input,
    interviewFeedbackSchema,
    GENERATE_TIMEOUT_MS
  );
}
