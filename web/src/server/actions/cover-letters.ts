"use server";

import { revalidatePath } from "next/cache";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { generateCoverLetterText } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { generateCoverLetterInputSchema, parsedResumeSchema } from "@/lib/schemas";
import { jobRowToAnalysis } from "@/server/resume-content";
import { requireUser, UnauthorizedError } from "@/server/users";

export interface GenerateCoverLetterResult {
  coverLetterId: string;
}

/**
 * Write a cover letter from a generated (tailored) resume: the letter is
 * grounded in the same truthful content the resume was built from.
 */
export async function generateCoverLetter(input: {
  generatedResumeId: string;
  tone?: string;
}): Promise<ActionResult<GenerateCoverLetterResult>> {
  try {
    const user = await requireUser();

    const parsedInput = generateCoverLetterInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return failure(parsedInput.error.issues[0]?.message ?? "Invalid selection.");
    }
    const { generatedResumeId, tone } = parsedInput.data;

    const generated = await db.generatedResume.findFirst({
      where: { id: generatedResumeId, userId: user.id },
      include: { jobDescription: true },
    });
    if (!generated) return failure("Generated resume not found.");

    const resume = parsedResumeSchema.parse(generated.content);
    const job = jobRowToAnalysis(generated.jobDescription);

    const content = await generateCoverLetterText({ job, resume, tone });

    const coverLetter = await db.coverLetter.create({
      data: {
        userId: user.id,
        jobDescriptionId: generated.jobDescriptionId,
        generatedResumeId: generated.id,
        tone,
        content,
      },
    });

    revalidatePath(`/generated/${generated.id}/cover-letter`);
    return success({ coverLetterId: coverLetter.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("generateCoverLetter failed:", err);
    return failure(
      toErrorMessage(err, "Cover letter generation failed. Check that the AI service is running.")
    );
  }
}

export async function deleteCoverLetter(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const existing = await db.coverLetter.findFirst({
      where: { id, userId: user.id },
      select: { generatedResumeId: true },
    });
    if (!existing) return failure("Cover letter not found.");

    await db.coverLetter.delete({ where: { id } });
    if (existing.generatedResumeId) {
      revalidatePath(`/generated/${existing.generatedResumeId}/cover-letter`);
    }
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteCoverLetter failed:", err);
    return failure("Could not delete this cover letter.");
  }
}
