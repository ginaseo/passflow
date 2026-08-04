import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { getDb, invalidateDb } from "./db";

describe("db", () => {
  it("invalidateDb 호출 후 getDb는 새 연결을 연다", async () => {
    const first = await getDb();
    const second = await getDb();
    expect(second).toBe(first);

    invalidateDb();
    const third = await getDb();
    expect(third).not.toBe(first);
  });

  it("invalidateDb는 기존 연결을 닫는다", async () => {
    const first = await getDb();
    const closeSpy = vi.spyOn(first, "close");

    invalidateDb();
    await getDb();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
