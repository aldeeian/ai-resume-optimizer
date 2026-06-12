import "server-only";

import type { Experience, JobDescription, Project, Resume } from "@prisma/client";
import { z } from "zod";

import {
  contactInfoSchema,
  educationEntrySchema,
  type JobAnalysis,
  type ParsedResume,
} from "@/lib/schemas";

/** Reshape a JobDescription row into the JobAnalysis wire contract. */
export function jobRowToAnalysis(job: JobDescription): JobAnalysis {
  return {
    title: job.title,
    company: job.company,
    seniority: job.seniority ?? "",
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    technologies: job.technologies,
    keywords: job.keywords,
    softSkills: job.softSkills,
    responsibilities: job.responsibilities,
  };
}

/** Reassemble a Resume row (with relations) into the ParsedResume contract. */
export function resumeRowToParsed(
  resume: Resume & { experiences: Experience[]; projects: Project[] }
): ParsedResume {
  return {
    contact: contactInfoSchema.parse(resume.contact ?? {}),
    summary: resume.summary ?? "",
    education: z.array(educationEntrySchema).parse(resume.education ?? []),
    skills: resume.skills,
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
}
