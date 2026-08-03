// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: () => Promise.reject(new Error("IndexedDB unavailable")),
}));

import { IndexedDbProgressRepository } from "./ProgressRepository";

beforeEach(() => {
  localStorage.clear();
});

describe("IndexedDbProgressRepository — IndexedDB 자체가 막힌 경우", () => {
  it("addWrongNote 호출 시 자동으로 폴백해 localStorage로 동작한다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.addWrongNote("q1");

    expect(await repo.getWrongNotes()).toEqual([{ questionId: "q1", addedAt: expect.any(Number) }]);
  });
});
