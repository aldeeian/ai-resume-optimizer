"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { fetchInterviewFeedback, fetchInterviewQuestions } from "@/lib/ai/client";
import { db } from "@/lib/db";
import {
  interviewAnswerSchema,
  interviewQuestionSchema,
  parsedResumeSchema,
  startInterviewInputSchema,
  submitInterviewAnswerSchema,
  type InterviewAnswer,
  type InterviewFeedback,
  type ParsedResume,
} from "@/lib/schemas";
import { jobRowToAnalysis, resumeRowToParsed } from "@/server/resume-content";
import { requireUser, UnauthorizedError } from "@/server/users";

export interface StartInterviewResult {
  sessionId: string;
}

/**
 * Create a mock interview session: resolve the job + resume content, ask the
 * ai-service for a tailored question set, and persist the session.
 */
export async function startInterview(input: {
  generatedResumeId?: string;
  jobDescriptionId?: string;
  resumeId?: string;
  numQuestions?: number;
}): Promise<ActionResult<StartInterviewResult>> {
  try {
    const user = await requireUser();

    const parsedInput = startInterviewInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return failure(parsedInput.error.issues[0]?.message ?? "Invalid selection.");
    }
    const { generatedResumeId, jobDescriptionId, resumeId, numQuestions } = parsedInput.data;

    let resume: ParsedResume;
    let jobId: string;
    let sourceResumeId: string | null = null;
    let usedGeneratedId: string | null = null;

    if (generatedResumeId) {
      const generated = await db.generatedResume.findFirst({
        where: { id: generatedResumeId, userId: user.id },
        include: { jobDescription: true },
      });
      if (!generated) return failure("Generated resume not found.");
      resume = parsedResumeSchema.parse(generated.content);
      jobId = generated.jobDescriptionId;
      sourceResumeId = generated.resumeId;
      usedGeneratedId = generated.id;
    } else {
      const [resumeRow, jobRow] = await Promise.all([
        db.resume.findFirst({
          where: { id: resumeId, userId: user.id },
          include: {
            experiences: { orderBy: { order: "asc" } },
            projects: { orderBy: { order: "asc" } },
          },
        }),
        db.jobDescription.findFirst({ where: { id: jobDescriptionId, userId: user.id } }),
      ]);
      if (!resumeRow) return failure("Resume not found.");
      if (!jobRow) return failure("Job description not found.");
      resume = resumeRowToParsed(resumeRow);
      jobId = jobRow.id;
      sourceResumeId = resumeRow.id;
    }

    const jobRow = await db.jobDescription.findFirst({
      where: { id: jobId, userId: user.id },
    });
    if (!jobRow) return failure("Job description not found.");

    const questions = await fetchInterviewQuestions({
      job: jobRowToAnalysis(jobRow),
      resume,
      numQuestions,
    });
    if (questions.length === 0) {
      return failure("Could not generate interview questions. Try again.");
    }

    const session = await db.interviewSession.create({
      data: {
        userId: user.id,
        jobDescriptionId: jobId,
        generatedResumeId: usedGeneratedId,
        resumeId: sourceResumeId,
        questions,
        answers: [],
      },
    });

    revalidatePath("/interview");
    return success({ sessionId: session.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("startInterview failed:", err);
    return failure(
      toErrorMessage(err, "Could not start the interview. Check that the AI service is running.")
    );
  }
}

export interface SubmitAnswerResult {
  feedback: InterviewFeedback;
  completed: boolean;
  overallScore: number | null;
}

/** Score one answer, persist it, and complete the session on the last one. */
export async function submitInterviewAnswer(input: {
  sessionId: string;
  questionId: string;
  answer: string;
}): Promise<ActionResult<SubmitAnswerResult>> {
  try {
    const user = await requireUser();

    const parsedInput = submitInterviewAnswerSchema.safeParse(input);
    if (!parsedInput.success) {
      return failure(parsedInput.error.issues[0]?.message ?? "Invalid answer.");
    }
    const { sessionId, questionId, answer } = parsedInput.data;

    const session = await db.interviewSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        jobDescription: true,
        resume: {
          include: {
            experiences: { orderBy: { order: "asc" } },
            projects: { orderBy: { order: "asc" } },
          },
        },
        generatedResume: { select: { content: true } },
      },
    });
    if (!session) return failure("Interview session not found.");
    if (session.status === "COMPLETED") return failure("This interview is already finished.");

    const questions = z.array(interviewQuestionSchema).parse(session.questions);
    const answers = z.array(interviewAnswerSchema).parse(session.answers ?? []);

    const question = questions.find((q) => q.id === questionId);
    if (!question) return failure("Question not found in this session.");
    if (answers.some((a) => a.questionId === questionId)) {
      return failure("This question was already answered.");
    }

    // Ground example answers in the same content the questions were built from.
    let resume: ParsedResume | undefined;
    if (session.generatedResume) {
      resume = parsedResumeSchema.parse(session.generatedResume.content);
    } else if (session.resume) {
      resume = resumeRowToParsed(session.resume);
    }

    const feedback = await fetchInterviewFeedback({
      job: jobRowToAnalysis(session.jobDescription),
      question,
      answer,
      resume,
    });

    const updatedAnswers: InterviewAnswer[] = [...answers, { questionId, answer, feedback }];
    const completed = updatedAnswers.length >= questions.length;
    const overallScore = completed
      ? Math.round(
          updatedAnswers.reduce((sum, a) => sum + a.feedback.score, 0) / updatedAnswers.length
        )
      : null;

    await db.interviewSession.update({
      where: { id: session.id },
      data: {
        answers: updatedAnswers,
        status: completed ? "COMPLETED" : "IN_PROGRESS",
        overallScore,
      },
    });

    revalidatePath(`/interview/${session.id}`);
    revalidatePath("/interview");
    return success({ feedback, completed, overallScore });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("submitInterviewAnswer failed:", err);
    return failure(
      toErrorMessage(err, "Could not score this answer. Check that the AI service is running.")
    );
  }
}

export async function deleteInterviewSession(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const deleted = await db.interviewSession.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) return failure("Interview session not found.");
    revalidatePath("/interview");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteInterviewSession failed:", err);
    return failure("Could not delete this interview session.");
  }
}
