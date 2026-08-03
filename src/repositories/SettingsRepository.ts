import { getDb } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const SETTINGS_KEY = "app";

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  updateSettings(settings: Settings): Promise<void>;
}

export class IndexedDbSettingsRepository implements SettingsRepository {
  async getSettings(): Promise<Settings> {
    const db = await getDb();
    const existing = await db.get("settings", SETTINGS_KEY);
    return existing ?? DEFAULT_SETTINGS;
  }

  async updateSettings(settings: Settings): Promise<void> {
    const db = await getDb();
    await db.put("settings", settings, SETTINGS_KEY);
  }
}
