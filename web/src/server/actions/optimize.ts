"use server";

import { revalidatePath } from "next/cache";

import { failure, success, toErrorMessage, type ActionResult } from "@/lib/action-result";
import { generateTailoredResume, rankAgainstJob } from "@/lib/ai/client";
import { computeAddedKeywords, computeRemovedContent } from "@/lib/ats/diff";
import { computeAtsScore, resumeToPlainText } from "@/lib/ats/score";
import { computeSkillGap, dedupeSkills } from "@/lib/ats/skills";
import { db } from "@/lib/db";
import {
  contactInfoSchema,
  educationEntrySchema,
  optimizeInputSchema,
  type JobAnalysis,
  type ParsedResume,
  type StoredExperienceRank,
  type StoredProjectRank,
} from "@/lib/schemas";
import { requireUser, UnauthorizedError } from "@/server/users";
import { z } from "zod";

export interface OptimizeResult {
  generatedResumeId: string;
}

// Selection policy: keep items that scored at least this, capped per section.
const MIN_RELEVANCE = 35;
const MAX_EXPERIENCES = 4;
const MAX_PROJECTS = 3;

/**
 * The full optimization pipeline:
 *   1. rank every experience/project against the job (AI, with reasoning)
 *   2. compute the missing-skills gap (deterministic)
 *   3. select the top experiences/projects
 *   4. generate the tailored resume from the selected content (AI, truthful)
 *   5. score it with the deterministic ATS engine
 *   6. compute the comparison diff and persist everything
 */
export async function optimizeResume(input: {
  resumeId: string;
  jobDescriptionId: string;
}): Promise<ActionResult<OptimizeResult>> {
  try {
    const user = await requireUser();

    const parsedInput = optimizeInputSchema.safeParse(input);
    if (!parsedInput.success) {
      return failure(parsedInput.error.issues[0]?.message ?? "Invalid selection.");
    }
    const { resumeId, jobDescriptionId } = parsedInput.data;

    const [resume, jobRow] = await Promise.all([
      db.resume.findFirst({
        where: { id: resumeId, userId: user.id },
        include: {
          experiences: { orderBy: { order: "asc" } },
          projects: { orderBy: { order: "asc" } },
        },
      }),
      db.jobDescription.findFirst({ where: { id: jobDescriptionId, userId: user.id } }),
    ]);
    if (!resume) return failure("Resume not found.");
    if (!jobRow) return failure("Job description not found.");

    const job: JobAnalysis = {
      title: jobRow.title,
      company: jobRow.company,
      seniority: jobRow.seniority ?? "",
      requiredSkills: jobRow.requiredSkills,
      preferredSkills: jobRow.preferredSkills,
      technologies: jobRow.technologies,
      keywords: jobRow.keywords,
      softSkills: jobRow.softSkills,
      responsibilities: jobRow.responsibilities,
    };

    // ── 1. Rank ───────────────────────────────────────────────────────────
    const ranking = await rankAgainstJob({
      job,
      experiences: resume.experiences.map((e) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        bullets: e.bullets,
      })),
      projects: resume.projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        technologies: p.technologies,
        bullets: p.bullets,
      })),
    });

    const expScoreById = new Map(ranking.experiences.map((r) => [r.id, r]));
    const projScoreById = new Map(ranking.projects.map((r) => [r.id, r]));

    // ── 2. Missing skills (deterministic) ─────────────────────────────────
    const jobSkills = dedupeSkills([
      ...job.requiredSkills,
      ...job.preferredSkills,
      ...job.technologies,
    ]);
    const gap = computeSkillGap(jobSkills, resume.skills, resume.rawText);

    // ── 3. Select top items ───────────────────────────────────────────────
    const rankedExperiences = [...resume.experiences].sort(
      (a, b) => (expScoreById.get(b.id)?.score ?? 0) - (expScoreById.get(a.id)?.score ?? 0)
    );
    let selectedExperiences = rankedExperiences
      .filter((e) => (expScoreById.get(e.id)?.score ?? 0) >= MIN_RELEVANCE)
      .slice(0, MAX_EXPERIENCES);
    if (selectedExperiences.length === 0 && rankedExperiences.length > 0) {
      selectedExperiences = rankedExperiences.slice(0, 1);
    }

    const rankedProjects = [...resume.projects].sort(
      (a, b) => (projScoreById.get(b.id)?.score ?? 0) - (projScoreById.get(a.id)?.score ?? 0)
    );
    let selectedProjects = rankedProjects
      .filter((p) => (projScoreById.get(p.id)?.score ?? 0) >= MIN_RELEVANCE)
      .slice(0, MAX_PROJECTS);
    if (selectedProjects.length === 0 && rankedProjects.length > 0) {
      selectedProjects = rankedProjects.slice(0, 1);
    }

    const selectedExpIds = new Set(selectedExperiences.map((e) => e.id));
    const selectedProjIds = new Set(selectedProjects.map((p) => p.id));

    // ── 4. Generate tailored content from the selected items ──────────────
    const contact = contactInfoSchema.parse(resume.contact ?? {});
    const education = z.array(educationEntrySchema).parse(resume.education ?? []);

    const sourceResume: ParsedResume = {
      contact,
      summary: resume.summary ?? "",
      education,
      skills: resume.skills,
      experiences: selectedExperiences.map((e) => ({
        company: e.company,
        title: e.title,
        location: e.location ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        current: e.current,
        bullets: e.bullets,
      })),
      projects: selectedProjects.map((p) => ({
        name: p.name,
        description: p.description ?? "",
        technologies: p.technologies,
        url: p.url ?? "",
        bullets: p.bullets,
      })),
    };

    const generated = await generateTailoredResume({ job, resume: sourceResume });

    // ── 5. Deterministic ATS score ─────────────────────────────────────────
    const { total, breakdown } = computeAtsScore({
      content: generated,
      job,
      includedExperienceScores: selectedExperiences.map((e) => ({
        score: expScoreById.get(e.id)?.score ?? 0,
      })),
      includedProjectScores: selectedProjects.map((p) => ({
        score: projScoreById.get(p.id)?.score ?? 0,
      })),
    });

    // ── 6. Comparison diff ─────────────────────────────────────────────────
    const fullOriginal: ParsedResume = {
      ...sourceResume,
      experiences: resume.experiences.map((e) => ({
        company: e.company,
        title: e.title,
        location: e.location ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        current: e.current,
        bullets: e.bullets,
      })),
      projects: resume.projects.map((p) => ({
        name: p.name,
        description: p.description ?? "",
        technologies: p.technologies,
        url: p.url ?? "",
        bullets: p.bullets,
      })),
    };
    const addedKeywords = computeAddedKeywords(
      resume.rawText,
      resumeToPlainText(generated),
      job
    );
    const removedContent = computeRemovedContent(fullOriginal, generated);

    const experienceRanking: StoredExperienceRank[] = resume.experiences.map((e) => {
      const r = expScoreById.get(e.id);
      return {
        id: e.id,
        name: `${e.title} — ${e.company}`,
        score: r?.score ?? 0,
        reasoning: r?.reasoning ?? "",
        matchedSkills: r?.matchedSkills ?? [],
        included: selectedExpIds.has(e.id),
      };
    });
    const projectRanking: StoredProjectRank[] = resume.projects.map((p) => {
      const r = projScoreById.get(p.id);
      return {
        id: p.id,
        name: p.name,
        score: r?.score ?? 0,
        matchedTechnologies: r?.matchedTechnologies ?? [],
        matchedSkills: r?.matchedSkills ?? [],
        included: selectedProjIds.has(p.id),
      };
    });

    const generatedResume = await db.generatedResume.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        jobDescriptionId: jobRow.id,
        content: generated,
        atsScore: total,
        scoreBreakdown: breakdown,
        experienceRanking,
        projectRanking,
        matchedSkills: gap.matched,
        missingSkills: gap.missing,
        addedKeywords,
        removedContent,
      },
    });

    revalidatePath("/generated");
    revalidatePath("/dashboard");
    revalidatePath("/analytics");
    return success({ generatedResumeId: generatedResume.id });
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("optimizeResume failed:", err);
    return failure(
      toErrorMessage(err, "Optimization failed. Check that the AI service is running and try again.")
    );
  }
}

export async function deleteGeneratedResume(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const deleted = await db.generatedResume.deleteMany({
      where: { id, userId: user.id },
    });
    if (deleted.count === 0) return failure("Generated resume not found.");
    revalidatePath("/generated");
    revalidatePath("/dashboard");
    return success(undefined);
  } catch (err) {
    if (err instanceof UnauthorizedError) return failure(err.message);
    console.error("deleteGeneratedResume failed:", err);
    return failure("Could not delete this generated resume.");
  }
}
