// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(async () => {
  // 테스트마다 DB를 비운다: fake-indexeddb는 프로세스 전역이라 이전 테스트의 데이터가 남는다.
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
  await db.clear("settings");
  localStorage.clear();
});

describe("IndexedDbProgressRepository", () => {
  it("복구된 IndexedDB에 남은 localStorage 폴백 데이터를 병합하고 지운다", async () => {
    localStorage.setItem("pf_wrongnotes_fallback", JSON.stringify({ q9: { questionId: "q9", addedAt: 123 } }));
    localStorage.setItem("pf_favorites_fallback", JSON.stringify({ q8: { questionId: "q8", addedAt: 456 } }));
    const repo = new IndexedDbProgressRepository();

    const notes = await repo.getWrongNotes();
    const favorites = await repo.getFavorites();

    expect(notes).toEqual([{ questionId: "q9", addedAt: 123 }]);
    expect(favorites).toEqual([{ questionId: "q8", addedAt: 456 }]);
    expect(localStorage.getItem("pf_wrongnotes_fallback")).toBeNull();
    expect(localStorage.getItem("pf_favorites_fallback")).toBeNull();
  });

  it("recordAttempt는 Attempt를 저장하고 QuestionStats를 갱신한다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.recordAttempt({
      questionId: "2023-1-Q1",
      solvedAt: 1000,
      mode: "study",
      entryType: "round",
      selectedAnswer: 2,
      isCorrect: true,
      solveTimeMs: 5000,
      sessionId: "session-1",
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
      entryType: "round" as const,
      selectedAnswer: 1,
      solveTimeMs: 1000,
    };

    await repo.recordAttempt({ ...base, solvedAt: 1000, isCorrect: true, sessionId: "session-1" });
    await repo.recordAttempt({ ...base, solvedAt: 2000, isCorrect: false, sessionId: "session-1" });
    await repo.recordAttempt({ ...base, solvedAt: 3000, isCorrect: true, sessionId: "session-1" });

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
    await repo.addWrongNote("2023-1-Q1", "study");
    await repo.addFavorite("2023-1-Q1");

    const db = await getDb();
    expect(await db.get("wrongNotes", "2023-1-Q1")).toBeDefined();
    expect(await db.get("favorites", "2023-1-Q1")).toBeDefined();
  });

  it("getWrongNotes / getFavorites는 추가한 항목을 전부 반환한다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1", "study");
    await repo.addWrongNote("Q2", "study");
    await repo.addFavorite("Q3");

    const wrongNotes = await repo.getWrongNotes();
    const favorites = await repo.getFavorites();

    expect(wrongNotes.map((n) => n.questionId).sort()).toEqual(["Q1", "Q2"]);
    expect(favorites.map((n) => n.questionId)).toEqual(["Q3"]);
  });

  it("아무것도 추가 안 했으면 getWrongNotes / getFavorites는 빈 배열", async () => {
    const repo = new IndexedDbProgressRepository();
    expect(await repo.getWrongNotes()).toEqual([]);
    expect(await repo.getFavorites()).toEqual([]);
  });

  it("removeWrongNote / removeFavorite는 해당 항목만 지운다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1", "study");
    await repo.addWrongNote("Q2", "study");
    await repo.addFavorite("Q3");

    await repo.removeWrongNote("Q1");
    await repo.removeFavorite("Q3");

    expect((await repo.getWrongNotes()).map((n) => n.questionId)).toEqual(["Q2"]);
    expect(await repo.getFavorites()).toEqual([]);
  });

  it("resetAll은 attempts/questionStats/wrongNotes/favorites를 전부 비운다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.recordAttempt({
      questionId: "Q1",
      solvedAt: 1000,
      mode: "study",
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
      sessionId: "session-1",
    });
    await repo.addWrongNote("Q1", "study");
    await repo.addFavorite("Q1");

    await repo.resetAll();

    expect(await repo.getAttempts()).toEqual([]);
    expect(await repo.getWrongNotes()).toEqual([]);
    expect(await repo.getFavorites()).toEqual([]);
    expect(await repo.getQuestionStats("Q1")).toEqual({
      questionId: "Q1",
      correctCount: 0,
      wrongCount: 0,
      lastSolvedAt: 0,
    });
  });

  it("같은 questionId를 두 번 addWrongNote해도 중복 저장되지 않는다 (upsert)", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1", "study");
    await repo.addWrongNote("Q1", "study");
    expect(await repo.getWrongNotes()).toHaveLength(1);
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
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
      sessionId: "session-1",
    });
    await repo.recordAttempt({
      questionId: "Q2",
      solvedAt: now,
      mode: "study",
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: false,
      solveTimeMs: 1000,
      sessionId: "session-1",
    });
    await repo.recordAttempt({
      questionId: "Q3",
      solvedAt: yesterday,
      mode: "study",
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
      sessionId: "session-1",
    });

    const summary = await repo.getDashboardSummary();
    expect(summary.todayCount).toBe(2);
    expect(summary.todayAccuracy).toBe(0.5);
    expect(summary.totalCount).toBe(3);
    expect(summary.totalAccuracy).toBeCloseTo(2 / 3);
  });

  it("resetAll은 폴백 여부와 관계없이 localStorage의 오답노트/즐겨찾기도 지우고, IndexedDB도 항상 시도해서 지운다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("q1", "study");
    await repo.addFavorite("q2");

    await repo.resetAll();

    expect(await repo.getWrongNotes()).toEqual([]);
    expect(await repo.getFavorites()).toEqual([]);
    const db = await getDb();
    expect(await db.getAll("wrongNotes")).toEqual([]);
    expect(await db.getAll("favorites")).toEqual([]);
  });

  it("importBackup은 wrongNotes/favorites를 questionId 기준으로 덮어쓰고, attempts는 추가하고, questionStats를 다시 계산한다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("q1", "study"); // 기존 데이터 — 백업에도 q1이 있으면 덮어써져야 함
    await repo.addFavorite("q9"); // 기존 데이터 — 백업에 없으니 그대로 남아야 함
    await repo.recordAttempt({
      questionId: "q1",
      solvedAt: 500,
      mode: "study",
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 100,
      sessionId: "session-old",
    });

    await repo.importBackup({
      attempts: [
        {
          questionId: "q1",
          solvedAt: 1000,
          mode: "exam",
          entryType: "round",
          selectedAnswer: 2,
          isCorrect: false,
          solveTimeMs: 200,
          sessionId: "session-imported",
        },
      ],
      wrongNotes: [{ questionId: "q1", addedAt: 9999, mode: "exam" }],
      favorites: [{ questionId: "q2", addedAt: 8888 }],
      settings: DEFAULT_SETTINGS,
    });

    const wrongNotes = await repo.getWrongNotes();
    expect(wrongNotes.find((n) => n.questionId === "q1")).toEqual({
      questionId: "q1",
      addedAt: 9999,
      mode: "exam",
    });

    const favorites = await repo.getFavorites();
    expect(favorites.map((f) => f.questionId).sort()).toEqual(["q2", "q9"]);

    const attempts = await repo.getAttempts("q1");
    expect(attempts).toHaveLength(2); // 기존 1개 + 가져온 1개

    const stats = await repo.getQuestionStats("q1");
    expect(stats).toEqual({
      questionId: "q1",
      correctCount: 1, // 기존 attempt(정답)
      wrongCount: 1, // 가져온 attempt(오답)
      lastSolvedAt: 1000, // 더 최근 solvedAt
    });
  });

  it("importBackup은 같은 백업을 두 번 가져와도 attempts를 중복 저장하지 않는다", async () => {
    const repo = new IndexedDbProgressRepository();
    const backup = {
      attempts: [
        {
          questionId: "q1",
          solvedAt: 1000,
          mode: "study" as const,
          entryType: "round" as const,
          selectedAnswer: 1,
          isCorrect: true,
          solveTimeMs: 100,
          sessionId: "session-a",
        },
      ],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    };

    await repo.importBackup(backup);
    await repo.importBackup(backup); // 같은 파일을 실수로 두 번 가져온 상황

    const attempts = await repo.getAttempts("q1");
    expect(attempts).toHaveLength(1);

    const stats = await repo.getQuestionStats("q1");
    expect(stats.correctCount).toBe(1);
    expect(stats.wrongCount).toBe(0);
  });

  it("importBackup은 settings도 같은 트랜잭션 안에서 저장한다", async () => {
    const repo = new IndexedDbProgressRepository();
    const importedSettings = {
      autoSaveWrongNotes: false,
      defaultMode: "exam" as const,
      timeoutBehavior: "ignore" as const,
      reviewOrder: "random" as const,
    };

    await repo.importBackup({
      attempts: [],
      wrongNotes: [],
      favorites: [],
      settings: importedSettings,
    });

    const db = await getDb();
    expect(await db.get("settings", "app")).toEqual(importedSettings);
  });
});
