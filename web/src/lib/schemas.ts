import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared domain schemas. These are the single source of truth for the shapes
// exchanged with the ai-service (camelCase over the wire) and stored in the
// Resume/GeneratedResume JSON columns.
// ─────────────────────────────────────────────────────────────────────────────

export const contactInfoSchema = z.object({
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  location: z.string().default(""),
  links: z.array(z.string()).default([]),
});

export const educationEntrySchema = z.object({
  institution: z.string().default(""),
  degree: z.string().default(""),
  field: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().default(""),
  highlights: z.array(z.string()).default([]),
});

export const parsedExperienceSchema = z.object({
  company: z.string().default(""),
  title: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false),
  bullets: z.array(z.string()).default([]),
});

export const parsedProjectSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  technologies: z.array(z.string()).default([]),
  url: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const parsedResumeSchema = z.object({
  contact: contactInfoSchema,
  summary: z.string().default(""),
  education: z.array(educationEntrySchema).default([]),
  skills: z.array(z.string()).default([]),
  experiences: z.array(parsedExperienceSchema).default([]),
  projects: z.array(parsedProjectSchema).default([]),
});

export const jobAnalysisSchema = z.object({
  title: z.string().default("Untitled role"),
  company: z.string().default("Unknown company"),
  seniority: z.string().default(""),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
});

export const experienceRankItemSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  reasoning: z.string().default(""),
  matchedSkills: z.array(z.string()).default([]),
});

export const projectRankItemSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  matchedTechnologies: z.array(z.string()).default([]),
  matchedSkills: z.array(z.string()).default([]),
});

export const rankResponseSchema = z.object({
  experiences: z.array(experienceRankItemSchema).default([]),
  projects: z.array(projectRankItemSchema).default([]),
});

export const generateResponseSchema = z.object({
  content: parsedResumeSchema,
});

// Ranking entries as persisted on GeneratedResume (enriched with display name
// and whether the item made it into the generated resume).
export const storedExperienceRankSchema = experienceRankItemSchema.extend({
  name: z.string(),
  included: z.boolean(),
});

export const storedProjectRankSchema = projectRankItemSchema.extend({
  name: z.string(),
  included: z.boolean(),
});

export const scoreBreakdownSchema = z.object({
  keywordMatch: z.object({ score: z.number(), max: z.number(), detail: z.string() }),
  skillsMatch: z.object({ score: z.number(), max: z.number(), detail: z.string() }),
  experienceMatch: z.object({ score: z.number(), max: z.number(), detail: z.string() }),
  projectMatch: z.object({ score: z.number(), max: z.number(), detail: z.string() }),
  formatting: z.object({ score: z.number(), max: z.number(), detail: z.string() }),
});

export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type ParsedExperience = z.infer<typeof parsedExperienceSchema>;
export type ParsedProject = z.infer<typeof parsedProjectSchema>;
export type ParsedResume = z.infer<typeof parsedResumeSchema>;
export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type ExperienceRankItem = z.infer<typeof experienceRankItemSchema>;
export type ProjectRankItem = z.infer<typeof projectRankItemSchema>;
export type RankResponse = z.infer<typeof rankResponseSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type StoredExperienceRank = z.infer<typeof storedExperienceRankSchema>;
export type StoredProjectRank = z.infer<typeof storedProjectRankSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Input validation schemas (user-facing forms / actions)
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_RESUME_EXTENSIONS = ["pdf", "docx", "txt"] as const;

export const analyzeJobInputSchema = z.object({
  rawText: z
    .string()
    .trim()
    .min(100, "Job description must be at least 100 characters.")
    .max(50_000, "Job description is too long (50,000 character max)."),
});

export const optimizeInputSchema = z.object({
  resumeId: z.string().min(1, "Choose a resume."),
  jobDescriptionId: z.string().min(1, "Choose a job description."),
});

export const applicationStatusSchema = z.enum([
  "SAVED",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
]);

export const createApplicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  position: z.string().trim().min(1, "Position is required.").max(200),
  url: z.union([z.string().trim().url("Enter a valid URL."), z.literal("")]).optional(),
  status: applicationStatusSchema.default("SAVED"),
  jobDescriptionId: z.string().optional(),
  generatedResumeId: z.string().optional(),
  appliedAt: z.string().optional(),
  interviewAt: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial().extend({
  id: z.string().min(1),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
});

export type ApplicationStatusValue = z.infer<typeof applicationStatusSchema>;
