import { describe, expect, it, vi } from "vitest";
import { verifyUnlockKey, createAccessCookieValue, verifyAccessCookieValue } from "@/lib/apiAuth";
import { toPublicQuestion } from "@/lib/questionSanitize";
import type { Question } from "@/types/question";

describe("apiAuth", () => {
  it("verifyUnlockKey passes when key matches env", () => {
    process.env.PASSFLOW_ACCESS_KEY = "test-secret";
    expect(verifyUnlockKey("test-secret")).toBe(true);
    expect(verifyUnlockKey("wrong")).toBe(false);
    delete process.env.PASSFLOW_ACCESS_KEY;
  });

  it("creates and verifies access cookie", async () => {
    process.env.PASSFLOW_ACCESS_KEY = "cookie-secret";
    const value = await createAccessCookieValue();
    expect(value).toBeTruthy();
    expect(await verifyAccessCookieValue(value!)).toBe(true);
    expect(await verifyAccessCookieValue("invalid")).toBe(false);
    delete process.env.PASSFLOW_ACCESS_KEY;
  });

  it("rejects an access cookie older than the max age", async () => {
    process.env.PASSFLOW_ACCESS_KEY = "cookie-secret";
    const value = await createAccessCookieValue();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8일 후(만료 기준 7일 초과)
      expect(await verifyAccessCookieValue(value!)).toBe(false);
    } finally {
      vi.useRealTimers();
      delete process.env.PASSFLOW_ACCESS_KEY;
    }
  });
});

describe("questionSanitize", () => {
  it("removes answer fields from public question", () => {
    const full: Question = {
      questionId: "2023-1-Q1",
      examId: "2023-1",
      qnum: 1,
      stem: "test",
      options: ["a", "b"],
      subject: 1,
      answer: 1,
      explanation: "exp",
      image: null,
    };
    const pub = toPublicQuestion(full);
    expect(JSON.stringify(pub)).not.toContain('"answer"');
    expect(JSON.stringify(pub)).not.toContain('"explanation"');
  });
});
