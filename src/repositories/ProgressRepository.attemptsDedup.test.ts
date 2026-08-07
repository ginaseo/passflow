// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";
import type { Attempt } from "@/types/progress";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  localStorage.clear();
});

function legacyAttempt(overrides: Partial<Omit<Attempt, "id">>): Omit<Attempt, "id"> {
  return {
    questionId: "2023-1-Q1",
    solvedAt: 1000,
    mode: "exam",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: false,
    solveTimeMs: 1000,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: 1000,
    ...overrides,
  };
}

describe("IndexedDbProgressRepository — #45 구버전 중복 attempt row 1회성 정리", () => {
  it("같은 (questionId, sessionId)로 쌓인 #41 이전 구버전 중복 row를 정리하고 questionStats를 재계산한다", async () => {
    const db = await getDb();
    // #41 이전 코드가 재선택마다 새 row를 추가하던 시절 남긴 구버전 데이터를 흉내낸다:
    // 같은 세션에서 문항을 세 번 재선택한 흔적(오답→오답→정답), questionStats는 그 시절
    // 로직대로 매번 +1 되어 3(=correctCount 1, wrongCount 2)까지 부풀려져 있다고 가정.
    await db.add("attempts", legacyAttempt({ solvedAt: 1000, isCorrect: false }));
    await db.add("attempts", legacyAttempt({ solvedAt: 2000, isCorrect: false }));
    await db.add("attempts", legacyAttempt({ solvedAt: 3000, isCorrect: true }));
    await db.put("questionStats", {
      questionId: "2023-1-Q1",
      correctCount: 1,
      wrongCount: 2,
      lastSolvedAt: 3000,
    });
    // 다른 문항은 정상 데이터(중복 없음) — 마이그레이션이 건드리면 안 된다.
    await db.add(
      "attempts",
      legacyAttempt({ questionId: "2023-1-Q2", sessionId: "session-2", solvedAt: 500, isCorrect: true })
    );
    await db.put("questionStats", {
      questionId: "2023-1-Q2",
      correctCount: 1,
      wrongCount: 0,
      lastSolvedAt: 500,
    });

    const repo = new IndexedDbProgressRepository();
    // 아무 조회나 트리거하면 마이그레이션이 한 번 돈다(reconcileIfNeeded 경유).
    await repo.getAttempts();

    const remaining = await repo.getAttempts("2023-1-Q1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].solvedAt).toBe(3000);
    expect(remaining[0].isCorrect).toBe(true);

    const stats1 = await repo.getQuestionStats("2023-1-Q1");
    expect(stats1.correctCount).toBe(1);
    expect(stats1.wrongCount).toBe(0);
    expect(stats1.lastSolvedAt).toBe(3000);

    const stats2 = await repo.getQuestionStats("2023-1-Q2");
    expect(stats2.correctCount).toBe(1);
    expect(stats2.wrongCount).toBe(0);
    expect(stats2.lastSolvedAt).toBe(500);
  });
});
