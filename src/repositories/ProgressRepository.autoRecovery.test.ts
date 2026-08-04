// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

let shouldFail = true;

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    getDb: () => (shouldFail ? Promise.reject(new Error("simulated IndexedDB unavailable")) : actual.getDb()),
    invalidateDb: actual.invalidateDb,
  };
});

import { IndexedDbProgressRepository } from "./ProgressRepository";
import { isStorageFallbackActive } from "./storageFallback";

beforeEach(() => {
  shouldFail = true;
  localStorage.clear();
});

describe("IndexedDbProgressRepository — 세션 중 IndexedDB 복구 자동 감지", () => {
  it("실패하다가 복구되면 다음 호출에서 자동으로 IndexedDB를 다시 쓰고, 폴백 중 쌓인 데이터를 병합한다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.addWrongNote("q1");
    expect(isStorageFallbackActive()).toBe(true);
    expect(localStorage.getItem("pf_wrongnotes_fallback")).not.toBeNull();

    shouldFail = false;
    const notes = await repo.getWrongNotes();

    expect(isStorageFallbackActive()).toBe(false);
    expect(notes).toEqual([{ questionId: "q1", addedAt: expect.any(Number) }]);
    expect(localStorage.getItem("pf_wrongnotes_fallback")).toBeNull();
  });
});
