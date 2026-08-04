// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { activateStorageFallback, isStorageFallbackActive } from "./storageFallback";
import { getDb } from "./db";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
  localStorage.clear();
});

describe("IndexedDbProgressRepository — 일부 스토어만 폴백 중일 때 배너 조기 해제 방지", () => {
  it("reconcile이 이미 한 번 완료된 뒤에도, 남은 폴백 데이터가 있으면 다른 스토어 성공 호출이 배너를 끄지 않는다", async () => {
    const repo = new IndexedDbProgressRepository();

    // reconcile을 한 번 성공시켜 memoized promise를 채워둔다 (이 시점엔 pending 데이터 없음)
    await repo.getAttempts();
    expect(isStorageFallbackActive()).toBe(false);

    // wrongNotes 관련 실패가 있었던 것처럼 흉내: 플래그를 켜고 pending 데이터를 남긴다
    activateStorageFallback();
    localStorage.setItem("pf_wrongnotes_fallback", JSON.stringify({ q1: { questionId: "q1", addedAt: 1 } }));

    // reconcilePromise는 이미 resolved 상태라 재조정을 다시 돌지 않는다 —
    // 가드가 없으면 이 호출이 그냥 배너를 꺼버릴 것
    await repo.getQuestionStats("q9");

    expect(isStorageFallbackActive()).toBe(true);
  });
});
