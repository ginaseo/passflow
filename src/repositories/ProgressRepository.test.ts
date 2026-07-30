import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";

beforeEach(async () => {
  // 테스트마다 DB를 비운다: fake-indexeddb는 프로세스 전역이라 이전 테스트의 데이터가 남는다.
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
});

describe("IndexedDbProgressRepository", () => {
  it("recordAttempt는 Attempt를 저장하고 QuestionStats를 갱신한다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.recordAttempt({
      questionId: "2023-1-Q1",
      solvedAt: 1000,
      mode: "study",
      selectedAnswer: 2,
      isCorrect: true,
      solveTimeMs: 5000,
    });

    const attempts = await repo.getAttempts("2023-1-Q1");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].isCorrect).toBe(true);

    const stats = await repo.getQuestionStats("2023-1-Q1");
    expect(stats).toEqual({
      questionId: "2023-1-Q1",
      correctCount: 1,
      wrongCount: 0,
      lastSolvedAt: 1000,
    });
  });

  it("같은 문제를 여러 번 풀면 QuestionStats가 누적된다", async () => {
    const repo = new IndexedDbProgressRepository();
    const base = {
      questionId: "2023-1-Q1",
      mode: "study" as const,
      selectedAnswer: 1,
      solveTimeMs: 1000,
    };

    await repo.recordAttempt({ ...base, solvedAt: 1000, isCorrect: true });
    await repo.recordAttempt({ ...base, solvedAt: 2000, isCorrect: false });
    await repo.recordAttempt({ ...base, solvedAt: 3000, isCorrect: true });

    const stats = await repo.getQuestionStats("2023-1-Q1");
    expect(stats.correctCount).toBe(2);
    expect(stats.wrongCount).toBe(1);
    expect(stats.lastSolvedAt).toBe(3000);
  });

  it("한 번도 안 푼 문제의 QuestionStats는 0으로 채워 반환한다", async () => {
    const repo = new IndexedDbProgressRepository();
    const stats = await repo.getQuestionStats("never-solved-Q1");
    expect(stats).toEqual({
      questionId: "never-solved-Q1",
      correctCount: 0,
      wrongCount: 0,
      lastSolvedAt: 0,
    });
  });

  it("addWrongNote / addFavorite는 questionId를 저장한다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("2023-1-Q1");
    await repo.addFavorite("2023-1-Q1");

    const db = await getDb();
    expect(await db.get("wrongNotes", "2023-1-Q1")).toBeDefined();
    expect(await db.get("favorites", "2023-1-Q1")).toBeDefined();
  });

  it("getDashboardSummary는 오늘/전체 정답률을 계산한다", async () => {
    const repo = new IndexedDbProgressRepository();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const yesterday = now - oneDayMs - 1000;

    await repo.recordAttempt({
      questionId: "Q1",
      solvedAt: now,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
    });
    await repo.recordAttempt({
      questionId: "Q2",
      solvedAt: now,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: false,
      solveTimeMs: 1000,
    });
    await repo.recordAttempt({
      questionId: "Q3",
      solvedAt: yesterday,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
    });

    const summary = await repo.getDashboardSummary();
    expect(summary.todayCount).toBe(2);
    expect(summary.todayAccuracy).toBe(0.5);
    expect(summary.totalCount).toBe(3);
    expect(summary.totalAccuracy).toBeCloseTo(2 / 3);
  });
});
