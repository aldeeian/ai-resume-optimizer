"use server";

import { revalidatePath } from "next/cache";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { parseResumeText } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { extractResumeText, FileValidationError } from "@/lib/parsing/extract-text";
import { requireUser, UnauthorizedError } from "@/server/users";

export interface UploadResumeResult {
  resumeId: string;
}

/**
 * Upload a resume file (PDF/DOCX/TXT), extract its text, parse it into
 * structured sections via the AI service, and persist everything.
 */
export async function uploadResume(
  formData: FormData
): Promise<ActionResult<UploadResumeResult>> {
  try {
    const user = await requireUser();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return failure("No file was uploaded.");
    }
    const isMaster = formData.get("isMaster") === "true";

    const { text, fileType } = await extractResumeText(file);
    const parsed = await parseResumeText(text);

    const title =
      parsed.contact.name.trim().length > 0
        ? `${parsed.contact.name} — ${file.name.replace(/\.[^.]+$/, "")}`
        : file.name.replace(/\.[^.]+$/, "");

    const resume = await db.$transaction(async (tx) => {
      if (isMaster) {
        await tx.resume.updateMany({
          where: { userId: user.id, isMaster: true },
          data: { isMaster: false },
        });
      }
      return tx.resume.create({
        data: {
          userId: user.id,
          title,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          rawText: text,
          contact: parsed.contact,
          summary: parsed.summary || null,
          education: parsed.education,
          skills: parsed.skills,
          isMaster,
          experiences: {
            create: parsed.experiences.map((exp, order) => ({
              company: exp.company,
              title: exp.title,
              location: exp.location || null,
              startDate: exp.startDate || null,
              endDate: exp.endDate || null,
              current: exp.current,
              bullets: exp.bullets,
              order,
            })),
          },
          projects: {
            create: parsed.projects.map((project, order) => ({
              name: project.name,
              description: project.description || null,
              technologies: project.technologies,
              url: project.url || null,
              bullets: project.bullets,
              order,
            })),
          },
        },
      });
    });

    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return success({ resumeId: resume.id });
  } catch (err) {
    if (err instanceof FileValidationError || err instanceof UnauthorizedError) {
      return failure(err.message);
    }
    console.error("uploadResume failed:", err);
    return failure(toErrorMessage(err, "Could not process this resume. Please try again."));
  }
}

export async function deleteResume(resumeId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const deleted = await db.resume.deleteMany({
      where: { id: resumeId, userId: user.id },
    });
    if (deleted.count === 0) {
      return failure("Resume not found.");
    }
    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteResume failed:", err);
    return failure("Could not delete this resume.");
  }
}

export async function setMasterResume(resumeId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db.$transaction(async (tx) => {
      const resume = await tx.resume.findFirst({
        where: { id: resumeId, userId: user.id },
        select: { id: true },
      });
      if (!resume) throw new Error("Resume not found.");
      await tx.resume.updateMany({
        where: { userId: user.id, isMaster: true },
        data: { isMaster: false },
      });
      await tx.resume.update({ where: { id: resumeId }, data: { isMaster: true } });
    });
    revalidatePath("/resumes");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    return failure(toErrorMessage(err, "Could not update master resume."));
  }
}
