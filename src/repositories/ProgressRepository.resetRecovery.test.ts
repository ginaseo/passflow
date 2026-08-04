// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
  localStorage.clear();
});

describe("IndexedDbProgressRepository — resetAll이 IndexedDB clear에 실패했던 흔적 복구", () => {
  it("reset_pending 마커가 남아있으면 다음 reconciliation에서 IndexedDB를 실제로 비운다", async () => {
    const db = await getDb();
    await db.add("attempts", {
      questionId: "q1",
      solvedAt: 1,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1,
      sessionId: "session-1",
    });
    await db.put("questionStats", { questionId: "q1", correctCount: 1, wrongCount: 0, lastSolvedAt: 1 });
    await db.put("wrongNotes", { questionId: "q1", addedAt: 1, mode: "study" });
    await db.put("favorites", { questionId: "q1", addedAt: 1 });
    localStorage.setItem("pf_reset_pending", "true");

    const repo = new IndexedDbProgressRepository();
    await repo.getWrongNotes();

    expect(await db.getAll("attempts")).toEqual([]);
    expect(await db.getAll("questionStats")).toEqual([]);
    expect(await db.getAll("wrongNotes")).toEqual([]);
    expect(await db.getAll("favorites")).toEqual([]);
    expect(localStorage.getItem("pf_reset_pending")).toBeNull();
  });
});
