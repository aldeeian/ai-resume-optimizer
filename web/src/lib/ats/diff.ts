import type { JobAnalysis, ParsedResume } from "@/lib/schemas";
import { dedupeSkills, normalizeText, skillInText } from "@/lib/ats/skills";

/**
 * Deterministic comparison between the original and generated resume:
 * which job keywords were added, and which original content was removed.
 */

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

/** Jaccard similarity over word tokens — robust to rewording. */
export function bulletSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) {
    if (tb.has(token)) intersection++;
  }
  return intersection / (ta.size + tb.size - intersection);
}

/** Job keywords/skills present in the generated resume but not the original. */
export function computeAddedKeywords(
  originalText: string,
  generatedText: string,
  job: JobAnalysis
): string[] {
  const original = normalizeText(originalText);
  const generated = normalizeText(generatedText);
  const candidates = dedupeSkills([
    ...job.keywords,
    ...job.requiredSkills,
    ...job.preferredSkills,
    ...job.technologies,
  ]);
  return candidates.filter(
    (kw) => skillInText(kw, generated) && !skillInText(kw, original)
  );
}

const REMOVED_SIMILARITY_THRESHOLD = 0.35;

/**
 * Original bullets/sections with no recognizable counterpart in the generated
 * resume (i.e. content that was dropped for relevance).
 */
export function computeRemovedContent(
  original: ParsedResume,
  generated: ParsedResume
): string[] {
  const generatedBullets = [
    ...generated.experiences.flatMap((e) => e.bullets),
    ...generated.projects.flatMap((p) => p.bullets),
    generated.summary,
  ].filter(Boolean);

  const removed: string[] = [];

  for (const exp of original.experiences) {
    const kept = generated.experiences.some(
      (g) => g.company.toLowerCase() === exp.company.toLowerCase()
    );
    if (!kept) {
      removed.push(`Experience: ${exp.title} — ${exp.company}`);
      continue;
    }
    for (const bullet of exp.bullets) {
      const hasMatch = generatedBullets.some(
        (g) => bulletSimilarity(bullet, g) >= REMOVED_SIMILARITY_THRESHOLD
      );
      if (!hasMatch) removed.push(bullet);
    }
  }

  for (const project of original.projects) {
    const kept = generated.projects.some(
      (g) => g.name.toLowerCase() === project.name.toLowerCase()
    );
    if (!kept) {
      removed.push(`Project: ${project.name}`);
      continue;
    }
    for (const bullet of project.bullets) {
      const hasMatch = generatedBullets.some(
        (g) => bulletSimilarity(bullet, g) >= REMOVED_SIMILARITY_THRESHOLD
      );
      if (!hasMatch) removed.push(bullet);
    }
  }

  return removed;
}
