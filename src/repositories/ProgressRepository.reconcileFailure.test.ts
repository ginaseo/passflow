// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: () =>
    Promise.resolve({
      transaction: () => {
        throw new Error("simulated write failure");
      },
    }),
}));

import { IndexedDbProgressRepository } from "./ProgressRepository";

beforeEach(() => {
  localStorage.clear();
});

describe("IndexedDbProgressRepository — reconciliation 중 write 실패", () => {
  it("IndexedDB write가 실패해도 localStorage 폴백 데이터를 지우지 않는다", async () => {
    localStorage.setItem("pf_wrongnotes_fallback", JSON.stringify({ q9: { questionId: "q9", addedAt: 123 } }));
    const repo = new IndexedDbProgressRepository();

    await repo.getWrongNotes();

    expect(localStorage.getItem("pf_wrongnotes_fallback")).not.toBeNull();
  });
});
