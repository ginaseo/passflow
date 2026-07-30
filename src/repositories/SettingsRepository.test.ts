import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbSettingsRepository } from "./SettingsRepository";
import { getDb } from "./db";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("settings");
});

describe("IndexedDbSettingsRepository", () => {
  it("저장된 값이 없으면 DEFAULT_SETTINGS를 반환한다", async () => {
    const repo = new IndexedDbSettingsRepository();
    expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("updateSettings로 저장한 값을 getSettings가 그대로 반환한다", async () => {
    const repo = new IndexedDbSettingsRepository();
    const next = { autoSaveWrongNotes: false, defaultMode: "exam" as const, timeoutBehavior: "ignore" as const };

    await repo.updateSettings(next);

    expect(await repo.getSettings()).toEqual(next);
  });

  it("updateSettings를 두 번 호출하면 마지막 값으로 덮어쓴다", async () => {
    const repo = new IndexedDbSettingsRepository();
    await repo.updateSettings({ ...DEFAULT_SETTINGS, autoSaveWrongNotes: false });
    await repo.updateSettings({ ...DEFAULT_SETTINGS, autoSaveWrongNotes: true });

    expect((await repo.getSettings()).autoSaveWrongNotes).toBe(true);
  });
});
