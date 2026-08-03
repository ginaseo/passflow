import { getDb } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import {
  activateStorageFallback,
  isStorageFallbackActive,
  readLocalStorage,
  writeLocalStorage,
} from "./storageFallback";

const SETTINGS_KEY = "app";
const SETTINGS_FALLBACK_KEY = "settings_fallback";

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  updateSettings(settings: Settings): Promise<void>;
}

export class IndexedDbSettingsRepository implements SettingsRepository {
  async getSettings(): Promise<Settings> {
    if (isStorageFallbackActive()) {
      return readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS);
    }
    try {
      const db = await getDb();
      const existing = await db.get("settings", SETTINGS_KEY);
      return existing ?? DEFAULT_SETTINGS;
    } catch {
      activateStorageFallback();
      return readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS);
    }
  }

  async updateSettings(settings: Settings): Promise<void> {
    if (isStorageFallbackActive()) {
      writeLocalStorage(SETTINGS_FALLBACK_KEY, settings);
      return;
    }
    try {
      const db = await getDb();
      await db.put("settings", settings, SETTINGS_KEY);
    } catch {
      activateStorageFallback();
      writeLocalStorage(SETTINGS_FALLBACK_KEY, settings);
    }
  }
}
