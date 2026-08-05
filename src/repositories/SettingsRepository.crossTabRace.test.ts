// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { getDb } from "./db";
import { IndexedDbSettingsRepository } from "./SettingsRepository";

// readLocalStorage를 가로채서, 첫 호출(= doReconcile이 오래된 폴백값을 읽는 시점) 때
// "다른 탭"이 마커를 지우고 새 settings를 이미 커밋한 상황을 흉내낸다.
vi.mock("./storageFallback", async () => {
  const actual = await vi.importActual<typeof import("./storageFallback")>("./storageFallback");
  return {
    ...actual,
    readLocalStorage: vi.fn((key: string, fallback: unknown) => {
      const value = actual.readLocalStorage(key, fallback);
      if (key === "settings_fallback") {
        localStorage.removeItem("pf_settings_fallback"); // "다른 탭"이 방금 이걸 처리하고 지웠다
      }
      return value;
    }),
  };
});

beforeEach(async () => {
  const db = await getDb();
  await db.clear("settings");
  localStorage.clear();
  vi.clearAllMocks();
});

describe("IndexedDbSettingsRepository — 탭 간 reconcile 레이스", () => {
  it("reconcile이 오래된 폴백 값을 읽는 사이 다른 탭이 마커를 지웠으면, 오래된 값을 쓰지 않는다", async () => {
    const staleSettings = { ...DEFAULT_SETTINGS, autoSaveWrongNotes: false };
    localStorage.setItem("pf_settings_fallback", JSON.stringify(staleSettings));

    // "다른 탭"이 이미 커밋해 둔 최신 settings
    const db = await getDb();
    const freshSettings = { ...DEFAULT_SETTINGS, autoSaveWrongNotes: true, defaultMode: "exam" as const };
    await db.put("settings", freshSettings, "app");

    const repo = new IndexedDbSettingsRepository();
    const result = await repo.getSettings();

    expect(result).toEqual(freshSettings);
    expect(await db.get("settings", "app")).toEqual(freshSettings);
  });
});
