// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbSettingsRepository } from "./SettingsRepository";
import { getDb } from "./db";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(async () => {
  const db = await getDb();
  await db.clear("settings");
  localStorage.clear();
});

describe("IndexedDbSettingsRepository — reconciliation 동시 호출 안전성", () => {
  it("getSettings을 동시에 두 번 호출해도 둘 다 마이그레이션된 값을 본다", async () => {
    localStorage.setItem("pf_settings_fallback", JSON.stringify({ ...DEFAULT_SETTINGS, autoSaveWrongNotes: false }));

    const repo = new IndexedDbSettingsRepository();
    const [a, b] = await Promise.all([repo.getSettings(), repo.getSettings()]);

    expect(a.autoSaveWrongNotes).toBe(false);
    expect(b.autoSaveWrongNotes).toBe(false);
  });
});
