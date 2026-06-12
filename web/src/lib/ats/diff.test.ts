import { describe, expect, it } from "vitest";

import { bulletSimilarity, computeAddedKeywords, computeRemovedContent } from "@/lib/ats/diff";
import type { JobAnalysis, ParsedResume } from "@/lib/schemas";

const emptyResume: Omit<ParsedResume, "experiences" | "projects"> = {
  contact: { name: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  education: [],
  skills: [],
};

function makeResume(input: {
  experiences?: ParsedResume["experiences"];
  projects?: ParsedResume["projects"];
  summary?: string;
}): ParsedResume {
  return {
    ...emptyResume,
    summary: input.summary ?? "",
    experiences: input.experiences ?? [],
    projects: input.projects ?? [],
  };
}

const exp = (company: string, bullets: string[]): ParsedResume["experiences"][number] => ({
  company,
  title: "Developer",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  bullets,
});

describe("bulletSimilarity", () => {
  it("is 1 for identical bullets", () => {
    expect(bulletSimilarity("Built the API gateway", "Built the API gateway")).toBe(1);
  });

  it("is high for a reworded bullet", () => {
    const similarity = bulletSimilarity(
      "Built REST endpoints for the billing service",
      "Developed billing service REST endpoints"
    );
    expect(similarity).toBeGreaterThan(0.4);
  });

  it("is 0 for unrelated bullets and empty input", () => {
    expect(bulletSimilarity("Cooked pasta", "Quantum chemistry")).toBe(0);
    expect(bulletSimilarity("", "anything")).toBe(0);
  });
});

describe("computeAddedKeywords", () => {
  const job: JobAnalysis = {
    title: "",
    company: "",
    seniority: "",
    requiredSkills: ["Kubernetes"],
    preferredSkills: [],
    technologies: ["PostgreSQL"],
    keywords: ["microservices"],
    softSkills: [],
    responsibilities: [],
  };

  it("returns only job terms newly present in the generated text", () => {
    const added = computeAddedKeywords(
      "Worked with PostgreSQL on data pipelines",
      "Built microservices backed by PostgreSQL",
      job
    );
    expect(added).toEqual(["microservices"]); // postgres was already there; k8s still missing
  });
});

describe("computeRemovedContent", () => {
  it("reports dropped experiences and projects by name", () => {
    const original = makeResume({
      experiences: [exp("Acme", ["Did things"]), exp("Beta Inc", ["Other things"])],
      projects: [
        {
          name: "Old Project",
          description: "",
          technologies: [],
          url: "",
          bullets: [],
        },
      ],
    });
    const generated = makeResume({ experiences: [exp("Acme", ["Did things"])] });

    const removed = computeRemovedContent(original, generated);
    expect(removed).toContain("Experience: Developer — Beta Inc");
    expect(removed).toContain("Project: Old Project");
  });

  it("does not report a bullet that was merely reworded", () => {
    const original = makeResume({
      experiences: [exp("Acme", ["Built REST endpoints for the billing service"])],
    });
    const generated = makeResume({
      experiences: [exp("Acme", ["Developed billing service REST endpoints"])],
    });
    expect(computeRemovedContent(original, generated)).toEqual([]);
  });

  it("reports a bullet with no recognizable counterpart", () => {
    const original = makeResume({
      experiences: [exp("Acme", ["Organized the office hockey tournament"])],
    });
    const generated = makeResume({
      experiences: [exp("Acme", ["Developed billing service REST endpoints"])],
    });
    expect(computeRemovedContent(original, generated)).toEqual([
      "Organized the office hockey tournament",
    ]);
  });
});
