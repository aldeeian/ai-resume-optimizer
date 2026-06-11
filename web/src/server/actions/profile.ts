"use server";

import { revalidatePath } from "next/cache";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { updateProfileSchema } from "@/lib/schemas";
import { requireUser, UnauthorizedError } from "@/server/users";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message ?? "Invalid profile.");
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        firstName: parsed.data.firstName ?? undefined,
        lastName: parsed.data.lastName ?? undefined,
      },
    });

    revalidatePath("/profile");
    revalidatePath("/settings");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("updateProfile failed:", err);
    return failure(toErrorMessage(err, "Could not update your profile."));
  }
}

/** Delete every row owned by the user (resumes, jobs, applications, runs). */
export async function deleteAllUserData(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    // Cascades wipe resumes→experiences/projects/generated, jobs, applications.
    await db.$transaction([
      db.application.deleteMany({ where: { userId: user.id } }),
      db.generatedResume.deleteMany({ where: { userId: user.id } }),
      db.jobDescription.deleteMany({ where: { userId: user.id } }),
      db.resume.deleteMany({ where: { userId: user.id } }),
    ]);
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteAllUserData failed:", err);
    return failure("Could not delete your data.");
  }
}
