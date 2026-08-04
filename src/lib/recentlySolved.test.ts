import { describe, expect, it } from "vitest";
import { getLastSessionQuestionIds } from "./recentlySolved";
import type { Attempt } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 1000,
    sessionId: "session-1",
    ...overrides,
  };
}

describe("getLastSessionQuestionIds", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(getLastSessionQuestionIds([])).toEqual([]);
  });

  it("가장 최근 세션의 문항만, 푼 순서대로 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: "session-old" }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: "session-old" }),
      makeAttempt({ questionId: "Q3", solvedAt: 5000, sessionId: "session-new" }),
      makeAttempt({ questionId: "Q4", solvedAt: 6000, sessionId: "session-new" }),
    ];
    expect(getLastSessionQuestionIds(attempts)).toEqual(["Q3", "Q4"]);
  });

  it("같은 세션 안에서 같은 문제를 여러 번 풀었으면 한 번만 나온다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: "session-1" }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: "session-1" }),
      makeAttempt({ questionId: "Q1", solvedAt: 3000, sessionId: "session-1" }),
    ];
    expect(getLastSessionQuestionIds(attempts)).toEqual(["Q1", "Q2"]);
  });

  it("sessionId가 없는 구버전 데이터는 각자 독립 세션으로 취급한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: undefined }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: undefined }),
    ];
    expect(getLastSessionQuestionIds(attempts)).toEqual(["Q2"]);
  });

  it("구버전 solvedAt 값과 우연히 같은 문자열의 sessionId가 있어도 서로 다른 세션으로 취급한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000, sessionId: undefined }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000, sessionId: "1000" }),
    ];
    expect(getLastSessionQuestionIds(attempts)).toEqual(["Q2"]);
  });
});
