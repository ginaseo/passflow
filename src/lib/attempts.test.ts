import { describe, expect, it } from "vitest";
import { dedupeAttemptsBySession } from "./attempts";
import type { Attempt } from "@/types/progress";

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: 1,
    questionId: "2023-1-Q1",
    solvedAt: 1000,
    mode: "exam",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 1000,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: 1000,
    ...overrides,
  };
}

describe("dedupeAttemptsBySession", () => {
  it("중복이 없으면 전부 그대로 남긴다", () => {
    const attempts = [
      attempt({ id: 1, sessionId: "session-1" }),
      attempt({ id: 2, sessionId: "session-2" }),
    ];
    const { kept, removedIds } = dedupeAttemptsBySession(attempts);
    expect(kept).toHaveLength(2);
    expect(removedIds).toEqual([]);
  });

  it("같은 (questionId, sessionId)는 가장 늦은 solvedAt만 남긴다", () => {
    const attempts = [
      attempt({ id: 1, sessionId: "session-1", solvedAt: 1000, isCorrect: false }),
      attempt({ id: 2, sessionId: "session-1", solvedAt: 3000, isCorrect: true }),
      attempt({ id: 3, sessionId: "session-1", solvedAt: 2000, isCorrect: false }),
    ];
    const { kept, removedIds } = dedupeAttemptsBySession(attempts);
    expect(kept).toEqual([attempt({ id: 2, sessionId: "session-1", solvedAt: 3000, isCorrect: true })]);
    expect(removedIds.sort()).toEqual([1, 3]);
  });

  it("solvedAt이 같으면 id가 더 큰 쪽을 최종값으로 취급한다", () => {
    const attempts = [
      attempt({ id: 1, sessionId: "session-1", solvedAt: 1000, isCorrect: false }),
      attempt({ id: 2, sessionId: "session-1", solvedAt: 1000, isCorrect: true }),
    ];
    const { kept, removedIds } = dedupeAttemptsBySession(attempts);
    expect(kept).toEqual([attempt({ id: 2, sessionId: "session-1", solvedAt: 1000, isCorrect: true })]);
    expect(removedIds).toEqual([1]);
  });

  it("다른 세션의 같은 문항은 각각 유지한다(누적 대상)", () => {
    const attempts = [
      attempt({ id: 1, sessionId: "session-1" }),
      attempt({ id: 2, sessionId: "session-2" }),
      attempt({ id: 3, sessionId: "session-3" }),
    ];
    const { kept, removedIds } = dedupeAttemptsBySession(attempts);
    expect(kept).toHaveLength(3);
    expect(removedIds).toEqual([]);
  });
});
