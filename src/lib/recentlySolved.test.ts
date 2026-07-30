import { describe, expect, it } from "vitest";
import { getRecentlySolvedQuestionIds } from "./recentlySolved";
import type { Attempt } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 1000,
    ...overrides,
  };
}

describe("getRecentlySolvedQuestionIds", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(getRecentlySolvedQuestionIds([], 10)).toEqual([]);
  });

  it("최근 푼 순서(내림차순)로 questionId를 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 3000 }),
      makeAttempt({ questionId: "Q3", solvedAt: 2000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 10)).toEqual(["Q2", "Q3", "Q1"]);
  });

  it("같은 문제를 여러 번 풀었으면 가장 최근 시각 기준으로 한 번만 나온다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000 }),
      makeAttempt({ questionId: "Q1", solvedAt: 5000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 10)).toEqual(["Q1", "Q2"]);
  });

  it("limit만큼만 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000 }),
      makeAttempt({ questionId: "Q3", solvedAt: 3000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 2)).toEqual(["Q3", "Q2"]);
  });
});
