import type { BulletEvidence } from "@/lib/schemas";

/** Map evidence entries by location for O(1) lookup while rendering. */
export function evidenceLookup(
  evidence: BulletEvidence[]
): Map<string, BulletEvidence> {
  return new Map(
    evidence.map((e) => [`${e.section}:${e.entryIndex}:${e.bulletIndex}`, e])
  );
}
