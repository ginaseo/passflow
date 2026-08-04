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

describe("IndexedDbProgressRepository — reconciliation 동시 호출 안전성", () => {
  it("getWrongNotes와 getFavorites을 동시에 호출해도 둘 다 마이그레이션된 데이터를 본다", async () => {
    localStorage.setItem("pf_wrongnotes_fallback", JSON.stringify({ q1: { questionId: "q1", addedAt: 1 } }));
    localStorage.setItem("pf_favorites_fallback", JSON.stringify({ q2: { questionId: "q2", addedAt: 2 } }));

    const repo = new IndexedDbProgressRepository();
    const [notes, favorites] = await Promise.all([repo.getWrongNotes(), repo.getFavorites()]);

    expect(notes).toEqual([{ questionId: "q1", addedAt: 1 }]);
    expect(favorites).toEqual([{ questionId: "q2", addedAt: 2 }]);
  });
});
