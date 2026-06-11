import type { JobAnalysis, ParsedResume, ScoreBreakdown } from "@/lib/schemas";
import { dedupeSkills, normalizeText, skillInText } from "@/lib/ats/skills";

/**
 * Deterministic ATS score engine.
 *
 * Weights (sum = 100):
 *   keywordMatch    30  — job keywords present in the resume text
 *   skillsMatch     25  — required (2x), preferred, and listed technologies
 *   experienceMatch 20  — average relevance score of included experiences
 *   projectMatch    15  — average relevance score of included projects
 *   formatting      10  — ATS-safe structure heuristics
 */

export const ATS_WEIGHTS = {
  keywordMatch: 30,
  skillsMatch: 25,
  experienceMatch: 20,
  projectMatch: 15,
  formatting: 10,
} as const;

export interface AtsScoreResult {
  total: number;
  breakdown: ScoreBreakdown;
}

/** Flatten a structured resume into plain text (also used for TXT export). */
export function resumeToPlainText(resume: ParsedResume): string {
  const lines: string[] = [];
  const { contact } = resume;

  if (contact.name) lines.push(contact.name);
  const contactLine = [contact.email, contact.phone, contact.location, ...contact.links]
    .filter(Boolean)
    .join(" | ");
  if (contactLine) lines.push(contactLine);

  if (resume.summary) {
    lines.push("", "SUMMARY", resume.summary);
  }

  if (resume.skills.length > 0) {
    lines.push("", "SKILLS", resume.skills.join(", "));
  }

  if (resume.experiences.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const exp of resume.experiences) {
      const dates = exp.current
        ? `${exp.startDate} – Present`
        : [exp.startDate, exp.endDate].filter(Boolean).join(" – ");
      lines.push(
        "",
        `${exp.title} — ${exp.company}`,
        [exp.location, dates].filter(Boolean).join(" | ")
      );
      for (const bullet of exp.bullets) lines.push(`• ${bullet}`);
    }
  }

  if (resume.projects.length > 0) {
    lines.push("", "PROJECTS");
    for (const project of resume.projects) {
      const tech = project.technologies.length > 0 ? ` (${project.technologies.join(", ")})` : "";
      lines.push("", `${project.name}${tech}`);
      if (project.description) lines.push(project.description);
      for (const bullet of project.bullets) lines.push(`• ${bullet}`);
    }
  }

  if (resume.education.length > 0) {
    lines.push("", "EDUCATION");
    for (const edu of resume.education) {
      const degree = [edu.degree, edu.field].filter(Boolean).join(", ");
      const dates = [edu.startDate, edu.endDate].filter(Boolean).join(" – ");
      lines.push(
        "",
        `${edu.institution}`,
        [degree, dates, edu.gpa ? `GPA: ${edu.gpa}` : ""].filter(Boolean).join(" | ")
      );
      for (const highlight of edu.highlights) lines.push(`• ${highlight}`);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function ratioScore(found: number, total: number, max: number): number {
  if (total === 0) return max; // nothing demanded → nothing missing
  return Math.round((found / total) * max);
}

interface RankedItemScore {
  score: number;
}

export function computeAtsScore(input: {
  content: ParsedResume;
  job: JobAnalysis;
  includedExperienceScores: RankedItemScore[];
  includedProjectScores: RankedItemScore[];
}): AtsScoreResult {
  const { content, job, includedExperienceScores, includedProjectScores } = input;
  const text = normalizeText(resumeToPlainText(content));

  // ── Keyword match (30) ─────────────────────────────────────────────────────
  const keywords = dedupeSkills(job.keywords);
  const keywordsFound = keywords.filter((k) => skillInText(k, text));
  const keywordScore = ratioScore(keywordsFound.length, keywords.length, ATS_WEIGHTS.keywordMatch);

  // ── Skills match (25): required ×2, preferred ×1, technologies ×1 ──────────
  const required = dedupeSkills(job.requiredSkills);
  const preferred = dedupeSkills(job.preferredSkills);
  const technologies = dedupeSkills(job.technologies);
  const requiredFound = required.filter((s) => skillInText(s, text)).length;
  const preferredFound = preferred.filter((s) => skillInText(s, text)).length;
  const techFound = technologies.filter((s) => skillInText(s, text)).length;
  const skillsWeightTotal = required.length * 2 + preferred.length + technologies.length;
  const skillsWeightFound = requiredFound * 2 + preferredFound + techFound;
  const skillsScore = ratioScore(skillsWeightFound, skillsWeightTotal, ATS_WEIGHTS.skillsMatch);

  // ── Experience match (20): mean relevance of what made it into the resume ──
  const expScore =
    includedExperienceScores.length === 0
      ? 0
      : Math.round(
          (includedExperienceScores.reduce((sum, e) => sum + e.score, 0) /
            includedExperienceScores.length /
            100) *
            ATS_WEIGHTS.experienceMatch
        );

  // ── Project match (15) ─────────────────────────────────────────────────────
  const projScore =
    includedProjectScores.length === 0
      ? 0
      : Math.round(
          (includedProjectScores.reduce((sum, p) => sum + p.score, 0) /
            includedProjectScores.length /
            100) *
            ATS_WEIGHTS.projectMatch
        );

  // ── Formatting (10): ATS-safe structure heuristics ─────────────────────────
  const formattingChecks: Array<{ ok: boolean; points: number; label: string }> = [
    { ok: /\S+@\S+\.\S+/.test(content.contact.email), points: 2, label: "contact email" },
    { ok: content.contact.phone.trim().length >= 7, points: 1, label: "phone number" },
    { ok: content.skills.length >= 3, points: 2, label: "skills section" },
    { ok: content.education.length > 0, points: 1, label: "education section" },
    {
      ok:
        content.experiences.length > 0 &&
        content.experiences.every((e) => e.bullets.length >= 1 && e.bullets.length <= 6),
      points: 2,
      label: "experience bullets (1–6 each)",
    },
    {
      ok: content.experiences
        .flatMap((e) => e.bullets)
        .concat(content.projects.flatMap((p) => p.bullets))
        .every((b) => b.length <= 300),
      points: 1,
      label: "concise bullets",
    },
    {
      ok: !/\b(i|my|me)\b/i.test(
        content.experiences.flatMap((e) => e.bullets).join(" ")
      ),
      points: 1,
      label: "no first-person pronouns",
    },
  ];
  const formattingScore = formattingChecks.reduce((sum, c) => sum + (c.ok ? c.points : 0), 0);
  const formattingFailed = formattingChecks.filter((c) => !c.ok).map((c) => c.label);

  const breakdown: ScoreBreakdown = {
    keywordMatch: {
      score: keywordScore,
      max: ATS_WEIGHTS.keywordMatch,
      detail: `${keywordsFound.length} of ${keywords.length} job keywords found.`,
    },
    skillsMatch: {
      score: skillsScore,
      max: ATS_WEIGHTS.skillsMatch,
      detail: `${requiredFound}/${required.length} required, ${preferredFound}/${preferred.length} preferred skills, ${techFound}/${technologies.length} technologies.`,
    },
    experienceMatch: {
      score: expScore,
      max: ATS_WEIGHTS.experienceMatch,
      detail:
        includedExperienceScores.length === 0
          ? "No experiences included."
          : `Average relevance of ${includedExperienceScores.length} included experience(s).`,
    },
    projectMatch: {
      score: projScore,
      max: ATS_WEIGHTS.projectMatch,
      detail:
        includedProjectScores.length === 0
          ? "No projects included."
          : `Average relevance of ${includedProjectScores.length} included project(s).`,
    },
    formatting: {
      score: formattingScore,
      max: ATS_WEIGHTS.formatting,
      detail:
        formattingFailed.length === 0
          ? "All ATS formatting checks passed."
          : `Improve: ${formattingFailed.join(", ")}.`,
    },
  };

  const total = Math.min(
    100,
    keywordScore + skillsScore + expScore + projScore + formattingScore
  );

  return { total, breakdown };
}
