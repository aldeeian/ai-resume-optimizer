import { describe, expect, it } from "vitest";

import { failure, success, toErrorMessage } from "@/lib/action-result";

describe("ActionResult helpers", () => {
  it("wraps success and failure", () => {
    expect(success(42)).toEqual({ ok: true, data: 42 });
    expect(failure("nope")).toEqual({ ok: false, error: "nope" });
  });
});

describe("toErrorMessage", () => {
  it("passes through short, safe error messages", () => {
    expect(toErrorMessage(new Error("Resume not found."))).toBe("Resume not found.");
  });

  it("hides messages that leak internal URLs", () => {
    const err = new Error("fetch failed for http://internal-service:8000/api");
    expect(toErrorMessage(err, "fallback")).toBe("fallback");
  });

  it("hides very long messages", () => {
    expect(toErrorMessage(new Error("x".repeat(400)), "fallback")).toBe("fallback");
  });

  it("falls back for non-Error values", () => {
    expect(toErrorMessage("string error")).toBe("Something went wrong.");
    expect(toErrorMessage(undefined)).toBe("Something went wrong.");
  });
});
