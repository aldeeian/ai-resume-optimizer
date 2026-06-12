import { describe, expect, it } from "vitest";

import {
  computeSkillGap,
  dedupeSkills,
  normalizeSkill,
  normalizeText,
  skillInText,
} from "@/lib/ats/skills";

describe("normalizeSkill", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeSkill("  React   ")).toBe("react");
    expect(normalizeSkill("Machine    Learning")).toBe("machine learning");
  });

  it("maps aliases to canonical names", () => {
    expect(normalizeSkill("JS")).toBe("javascript");
    expect(normalizeSkill("k8s")).toBe("kubernetes");
    expect(normalizeSkill("Postgres")).toBe("postgresql");
    expect(normalizeSkill("NodeJS")).toBe("node.js");
    expect(normalizeSkill("C Sharp")).toBe("c#");
  });

  it("strips trailing punctuation before alias lookup", () => {
    expect(normalizeSkill("react.js,")).toBe("react");
  });
});

describe("skillInText", () => {
  const text = normalizeText(
    "Built services in C++ and C# on .NET; wrote JavaScript and Java tools with PostgreSQL"
  );

  it("matches symbol-bearing skills where \\b fails", () => {
    expect(skillInText("C++", text)).toBe(true);
    expect(skillInText("C#", text)).toBe(true);
    expect(skillInText(".NET", text)).toBe(true);
  });

  it("does not match a skill inside a longer word", () => {
    // "java" must not match inside "javascript"
    expect(skillInText("java", normalizeText("I write javascript daily"))).toBe(false);
    expect(skillInText("java", text)).toBe(true);
  });

  it("matches through aliases", () => {
    expect(skillInText("postgres", text)).toBe(true);
  });

  it("returns false for empty skill", () => {
    expect(skillInText("", text)).toBe(false);
  });
});

describe("computeSkillGap", () => {
  it("matches against the skill list and the resume text", () => {
    const gap = computeSkillGap(
      ["Python", "Docker", "GraphQL"],
      ["Python"],
      "Containerized the service with Docker for deployment"
    );
    expect(gap.matched).toEqual(["Python", "Docker"]);
    expect(gap.missing).toEqual(["GraphQL"]);
  });

  it("deduplicates aliased job skills", () => {
    const gap = computeSkillGap(["JS", "JavaScript"], [], "javascript everywhere");
    expect(gap.matched).toEqual(["JS"]); // second spelling is the same skill
    expect(gap.missing).toEqual([]);
  });
});

describe("dedupeSkills", () => {
  it("keeps first casing and drops normalized duplicates", () => {
    expect(dedupeSkills(["React", "react.js", "ReactJS", "Vue"])).toEqual(["React", "Vue"]);
  });

  it("drops empty entries", () => {
    expect(dedupeSkills(["", "  ", "Go"])).toEqual(["Go"]);
  });
});
