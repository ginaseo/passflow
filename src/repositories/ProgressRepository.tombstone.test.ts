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

describe("IndexedDbProgressRepository — 폴백 중 삭제가 복구 후 IndexedDB에도 반영됨", () => {
  it("wrongnotes tombstone이 있으면 reconciliation이 해당 IndexedDB 행을 지운다", async () => {
    const db = await getDb();
    await db.put("wrongNotes", { questionId: "q5", addedAt: 1, mode: "study" });
    localStorage.setItem("pf_wrongnotes_tombstones", JSON.stringify({ q5: true }));

    const repo = new IndexedDbProgressRepository();
    const notes = await repo.getWrongNotes();

    expect(notes).toEqual([]);
    expect(await db.getAll("wrongNotes")).toEqual([]);
    expect(localStorage.getItem("pf_wrongnotes_tombstones")).toBeNull();
  });
});
