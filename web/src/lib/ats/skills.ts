/**
 * Skill normalization and matching.
 *
 * Deterministic (no LLM): used by the missing-skills analysis and the ATS
 * score engine so results are reproducible and unit-testable.
 */

const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  "java script": "javascript",
  ts: "typescript",
  "react.js": "react",
  reactjs: "react",
  "next js": "next.js",
  nextjs: "next.js",
  node: "node.js",
  nodejs: "node.js",
  "node js": "node.js",
  "vue.js": "vue",
  vuejs: "vue",
  postgres: "postgresql",
  "postgre sql": "postgresql",
  k8s: "kubernetes",
  golang: "go",
  "c plus plus": "c++",
  cpp: "c++",
  "c sharp": "c#",
  csharp: "c#",
  "dot net": ".net",
  dotnet: ".net",
  sklearn: "scikit-learn",
  "scikit learn": "scikit-learn",
  gcp: "google cloud",
  "google cloud platform": "google cloud",
  "amazon web services": "aws",
  "ms sql": "sql server",
  mssql: "sql server",
  "rest api": "rest",
  "restful api": "rest",
  "restful apis": "rest",
  "rest apis": "rest",
  "ci cd": "ci/cd",
  cicd: "ci/cd",
  "github actions": "ci/cd",
  tailwindcss: "tailwind css",
  tailwind: "tailwind css",
  "express.js": "express",
  expressjs: "express",
  mongo: "mongodb",
};

/** Canonicalize a skill string for comparison. */
export function normalizeSkill(skill: string): string {
  const cleaned = skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();
  return SKILL_ALIASES[cleaned] ?? cleaned;
}

/** Escape a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whether a skill appears in free text. Uses look-around boundaries that work
 * for symbol-bearing skills like "c++", "c#", and ".net" where `\b` fails.
 */
export function skillInText(skill: string, normalizedText: string): boolean {
  const needle = normalizeSkill(skill);
  if (!needle) return false;
  const pattern = new RegExp(
    `(?<![a-z0-9+#.])${escapeRegExp(needle)}(?![a-z0-9+#])`,
    "i"
  );
  return pattern.test(normalizedText);
}

/** Lowercase text once so repeated skillInText calls stay cheap. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export interface SkillGap {
  /** Job skills found in the resume (original casing from the job posting). */
  matched: string[];
  /** Job skills absent from the resume. */
  missing: string[];
}

/**
 * Compare the skills a job asks for against a resume (its skill list plus its
 * full text, so skills demonstrated in bullets still count as present).
 */
export function computeSkillGap(
  jobSkills: string[],
  resumeSkills: string[],
  resumeText: string
): SkillGap {
  const resumeSkillSet = new Set(resumeSkills.map(normalizeSkill));
  const haystack = normalizeText(resumeText);

  const matched: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const jobSkill of jobSkills) {
    const normalized = normalizeSkill(jobSkill);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    if (resumeSkillSet.has(normalized) || skillInText(jobSkill, haystack)) {
      matched.push(jobSkill);
    } else {
      missing.push(jobSkill);
    }
  }

  return { matched, missing };
}

/** Deduplicate a list of skills after normalization, keeping first casing. */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of skills) {
    const normalized = normalizeSkill(skill);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(skill);
  }
  return out;
}
