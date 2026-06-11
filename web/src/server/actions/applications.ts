"use server";

import { revalidatePath } from "next/cache";
import type { Application, ApplicationStatus } from "@prisma/client";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import {
  applicationStatusSchema,
  createApplicationSchema,
  updateApplicationSchema,
} from "@/lib/schemas";
import { requireUser, UnauthorizedError } from "@/server/users";

function parseDate(value: string | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Stamp stage timestamps the first time an application enters a stage. */
function stageTimestamps(
  status: ApplicationStatus,
  existing?: Pick<Application, "appliedAt" | "interviewAt" | "offerAt" | "rejectedAt">
) {
  const now = new Date();
  return {
    appliedAt:
      status !== "SAVED" && !existing?.appliedAt ? now : undefined,
    interviewAt:
      status === "INTERVIEWING" && !existing?.interviewAt ? now : undefined,
    offerAt: status === "OFFER" && !existing?.offerAt ? now : undefined,
    rejectedAt: status === "REJECTED" && !existing?.rejectedAt ? now : undefined,
  };
}

export async function createApplication(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const parsed = createApplicationSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid application.");
    }
    const data = parsed.data;

    // Only link rows the user actually owns.
    if (data.jobDescriptionId) {
      const owns = await db.jobDescription.findFirst({
        where: { id: data.jobDescriptionId, userId: user.id },
        select: { id: true },
      });
      if (!owns) return failure("Job description not found.");
    }
    if (data.generatedResumeId) {
      const owns = await db.generatedResume.findFirst({
        where: { id: data.generatedResumeId, userId: user.id },
        select: { id: true },
      });
      if (!owns) return failure("Generated resume not found.");
    }

    const created = await db.application.create({
      data: {
        userId: user.id,
        company: data.company,
        position: data.position,
        url: data.url || null,
        status: data.status,
        jobDescriptionId: data.jobDescriptionId || null,
        generatedResumeId: data.generatedResumeId || null,
        appliedAt: parseDate(data.appliedAt) ?? stageTimestamps(data.status).appliedAt ?? null,
        interviewAt: parseDate(data.interviewAt) ?? null,
        notes: data.notes || null,
      },
    });

    revalidatePath("/tracker");
    revalidatePath("/analytics");
    revalidatePath("/dashboard");
    return success({ id: created.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("createApplication failed:", err);
    return failure(toErrorMessage(err, "Could not create the application."));
  }
}

export async function updateApplication(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateApplicationSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid update.");
    }
    const { id, ...data } = parsed.data;

    const existing = await db.application.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return failure("Application not found.");

    const stamps: ReturnType<typeof stageTimestamps> = data.status
      ? stageTimestamps(data.status, existing)
      : { appliedAt: undefined, interviewAt: undefined, offerAt: undefined, rejectedAt: undefined };

    await db.application.update({
      where: { id: existing.id },
      data: {
        company: data.company,
        position: data.position,
        url: data.url === undefined ? undefined : data.url || null,
        status: data.status,
        notes: data.notes === undefined ? undefined : data.notes || null,
        appliedAt: parseDate(data.appliedAt) ?? stamps.appliedAt,
        interviewAt: parseDate(data.interviewAt) ?? stamps.interviewAt,
        offerAt: stamps.offerAt,
        rejectedAt: stamps.rejectedAt,
      },
    });

    revalidatePath("/tracker");
    revalidatePath("/analytics");
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("updateApplication failed:", err);
    return failure(toErrorMessage(err, "Could not update the application."));
  }
}

export async function updateApplicationStatus(input: {
  id: string;
  status: string;
}): Promise<ActionResult> {
  const status = applicationStatusSchema.safeParse(input.status);
  if (!status.success) return failure("Invalid status.");
  return updateApplication({ id: input.id, status: status.data });
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const deleted = await db.application.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) return failure("Application not found.");
    revalidatePath("/tracker");
    revalidatePath("/analytics");
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteApplication failed:", err);
    return failure("Could not delete the application.");
  }
}
