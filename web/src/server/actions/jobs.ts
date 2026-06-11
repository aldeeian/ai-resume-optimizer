"use server";

import { revalidatePath } from "next/cache";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { analyzeJobText } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { analyzeJobInputSchema } from "@/lib/schemas";
import { requireUser, UnauthorizedError } from "@/server/users";

export interface AnalyzeJobResult {
  jobDescriptionId: string;
}

/** Analyze a pasted job description and persist the structured result. */
export async function analyzeJob(input: {
  rawText: string;
}): Promise<ActionResult<AnalyzeJobResult>> {
  try {
    const user = await requireUser();

    const parsed = analyzeJobInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid job description.");
    }

    const analysis = await analyzeJobText(parsed.data.rawText);

    const job = await db.jobDescription.create({
      data: {
        userId: user.id,
        title: analysis.title,
        company: analysis.company,
        seniority: analysis.seniority || null,
        rawText: parsed.data.rawText,
        requiredSkills: analysis.requiredSkills,
        preferredSkills: analysis.preferredSkills,
        technologies: analysis.technologies,
        keywords: analysis.keywords,
        softSkills: analysis.softSkills,
        responsibilities: analysis.responsibilities,
      },
    });

    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return success({ jobDescriptionId: job.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("analyzeJob failed:", err);
    return failure(toErrorMessage(err, "Could not analyze this job description."));
  }
}

export async function deleteJob(jobDescriptionId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const deleted = await db.jobDescription.deleteMany({
      where: { id: jobDescriptionId, userId: user.id },
    });
    if (deleted.count === 0) return failure("Job description not found.");
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteJob failed:", err);
    return failure("Could not delete this job description.");
  }
}
