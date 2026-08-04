// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

let shouldFail = true;

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    getDb: () => (shouldFail ? Promise.reject(new Error("simulated IndexedDB unavailable")) : actual.getDb()),
  };
});

import { IndexedDbSettingsRepository } from "./SettingsRepository";
import { isStorageFallbackActive } from "./storageFallback";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(() => {
  shouldFail = true;
  localStorage.clear();
});

describe("IndexedDbSettingsRepository — 세션 중 IndexedDB 복구 자동 감지", () => {
  it("실패하다가 복구되면 다음 호출에서 자동으로 IndexedDB를 다시 쓰고 폴백을 해제한다", async () => {
    const repo = new IndexedDbSettingsRepository();

    const duringOutage = await repo.getSettings();
    expect(duringOutage).toEqual(DEFAULT_SETTINGS);
    expect(isStorageFallbackActive()).toBe(true);

    await repo.updateSettings({ ...DEFAULT_SETTINGS, autoSaveWrongNotes: false });
    expect(localStorage.getItem("pf_settings_fallback")).not.toBeNull();

    shouldFail = false;
    const recovered = await repo.getSettings();

    expect(isStorageFallbackActive()).toBe(false);
    expect(recovered.autoSaveWrongNotes).toBe(false);
    expect(localStorage.getItem("pf_settings_fallback")).toBeNull();
  });
});
