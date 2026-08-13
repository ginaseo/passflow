// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { AUTO_BACKUP_KEY, readAutoBackup, writeAutoBackup } from "./autoBackup";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { Attempt } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 1,
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 500,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("writeAutoBackup/readAutoBackup", () => {
  it("쓴 스냅샷을 그대로 읽어올 수 있다", () => {
    writeAutoBackup({
      attempts: [makeAttempt()],
      questionStats: [{ questionId: "Q1", correctCount: 1, wrongCount: 0, lastSolvedAt: 1000 }],
      wrongNotes: [{ questionId: "Q2", addedAt: 2000, mode: "exam" }],
      favorites: [{ questionId: "Q3", addedAt: 3000 }],
      settings: DEFAULT_SETTINGS,
    });

    const backup = readAutoBackup();
    expect(backup).not.toBeNull();
    expect(backup?.wrongNotes).toEqual([{ questionId: "Q2", addedAt: 2000, mode: "exam" }]);
    expect(backup?.attempts).toEqual([
      {
        questionId: "Q1",
        solvedAt: 1000,
        mode: "study",
        entryType: "round",
        selectedAnswer: 1,
        isCorrect: true,
        solveTimeMs: 500,
        sessionId: "session-1",
        timeLimitMs: null,
        sessionStartedAt: 1000,
      },
    ]);
  });

  it("저장된 게 없으면 null을 반환한다", () => {
    expect(readAutoBackup()).toBeNull();
  });

  it("저장된 값이 깨진 JSON이면 null을 반환한다", () => {
    localStorage.setItem(AUTO_BACKUP_KEY, "not json");
    expect(readAutoBackup()).toBeNull();
  });
});
