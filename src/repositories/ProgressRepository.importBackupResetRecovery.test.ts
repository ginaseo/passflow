// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
  await db.clear("settings");
  localStorage.clear();
});

describe("IndexedDbProgressRepository — importBackup과 대기중인 RESET_PENDING 처리 순서", () => {
  it("importBackup은 대기중인 RESET_PENDING 마커를 먼저 처리한 뒤 병합한다 — 그래야 방금 가져온 데이터가 나중에 지워지지 않는다", async () => {
    localStorage.setItem("pf_reset_pending", "true");
    const db = await getDb();
    await db.add("attempts", {
      questionId: "stale",
      solvedAt: 1,
      mode: "study",
      entryType: "round",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1,
      sessionId: "session-stale",
    });

    const repo = new IndexedDbProgressRepository();
    await repo.importBackup({
      attempts: [
        {
          questionId: "q1",
          solvedAt: 1000,
          mode: "study",
          entryType: "round",
          selectedAnswer: 1,
          isCorrect: true,
          solveTimeMs: 100,
          sessionId: "session-import",
        },
      ],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    });

    // reset_pending이 importBackup 시작 시점에 이미 처리됐어야 하므로,
    // stale 데이터는 지워지고 방금 가져온 q1 attempt는 살아있어야 한다.
    const attempts = await repo.getAttempts();
    expect(attempts.map((a) => a.questionId)).toEqual(["q1"]);
    expect(localStorage.getItem("pf_reset_pending")).toBeNull();
  });
});
