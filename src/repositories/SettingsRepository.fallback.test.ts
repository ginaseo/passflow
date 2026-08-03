// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: () => Promise.reject(new Error("IndexedDB unavailable")),
}));

import { IndexedDbSettingsRepository } from "./SettingsRepository";
import { DEFAULT_SETTINGS } from "@/types/settings";

beforeEach(() => {
  localStorage.clear();
});

describe("IndexedDbSettingsRepository — IndexedDB 자체가 막힌 경우", () => {
  it("getDb()가 던지면 자동으로 폴백해 localStorage로 동작한다", async () => {
    const repo = new IndexedDbSettingsRepository();

    const next = { ...DEFAULT_SETTINGS, defaultMode: "exam" as const };
    await repo.updateSettings(next);

    expect(await repo.getSettings()).toEqual(next);
  });
});
