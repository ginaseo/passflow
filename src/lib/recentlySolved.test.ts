import { describe, expect, it } from "vitest";
import { getAllSolvedQuestionIds } from "./recentlySolved";
import type { Attempt } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 1000,
    sessionId: "session-1",
    ...overrides,
  };
}

describe("getAllSolvedQuestionIds", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(getAllSolvedQuestionIds([])).toEqual([]);
  });

  it("여러 세션에 걸쳐 푼 문제 전체를, 가장 최근에 푼 게 맨 위로 오도록 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: "session-old" }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: "session-old" }),
      makeAttempt({ questionId: "Q3", solvedAt: 5000, sessionId: "session-new" }),
      makeAttempt({ questionId: "Q4", solvedAt: 6000, sessionId: "session-new" }),
    ];
    expect(getAllSolvedQuestionIds(attempts)).toEqual(["Q4", "Q3", "Q2", "Q1"]);
  });

  it("같은 문제를 여러 번 풀었으면 한 번만 나오고, 그 중 가장 최근 풀이 시각으로 정렬된다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: "session-1" }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: "session-1" }),
      makeAttempt({ questionId: "Q1", solvedAt: 3000, sessionId: "session-2" }),
    ];
    expect(getAllSolvedQuestionIds(attempts)).toEqual(["Q1", "Q2"]);
  });

  it("sessionId가 없는 구버전 데이터도 solvedAt 기준으로 똑같이 정렬된다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: undefined }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: undefined }),
    ];
    expect(getAllSolvedQuestionIds(attempts)).toEqual(["Q2", "Q1"]);
  });
});
