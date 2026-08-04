// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: () =>
    Promise.resolve({
      transaction: () => {
        throw new Error("simulated quota exceeded");
      },
    }),
  invalidateDb: () => {},
}));

import { IndexedDbProgressRepository } from "./ProgressRepository";
import { isStorageFallbackActive } from "./storageFallback";

beforeEach(() => {
  localStorage.clear();
});

describe("IndexedDbProgressRepository — attempts 쓰기 실패가 다른 스토어에 전파되지 않음", () => {
  it("recordAttempt이 트랜잭션 단계에서 실패해도 전역 폴백 플래그를 켜지 않는다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.recordAttempt({
      questionId: "q1",
      solvedAt: 1000,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
    });

    expect(isStorageFallbackActive()).toBe(false);
  });
});
