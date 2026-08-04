// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: () =>
    Promise.resolve({
      put: () => Promise.reject(new Error("simulated write failure")),
    }),
}));

import { IndexedDbSettingsRepository } from "./SettingsRepository";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(() => {
  localStorage.clear();
});

describe("IndexedDbSettingsRepository — reconciliation 중 write 실패", () => {
  it("IndexedDB write가 실패해도 localStorage 폴백 데이터를 지우지 않는다", async () => {
    localStorage.setItem("pf_settings_fallback", JSON.stringify({ ...DEFAULT_SETTINGS, autoSaveWrongNotes: false }));
    const repo = new IndexedDbSettingsRepository();

    await repo.getSettings();

    expect(localStorage.getItem("pf_settings_fallback")).not.toBeNull();
  });
});
