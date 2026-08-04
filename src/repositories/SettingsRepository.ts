import { getDb } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import {
  activateStorageFallback,
  clearLocalStorage,
  hasLocalStorageData,
  isStorageFallbackActive,
  readLocalStorage,
  writeLocalStorage,
} from "./storageFallback";

const SETTINGS_KEY = "app";
const SETTINGS_FALLBACK_KEY = "settings_fallback";

let reconciled = false;

async function reconcileIfNeeded(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (reconciled) return;
  reconciled = true;
  if (!hasLocalStorageData(SETTINGS_FALLBACK_KEY)) return;
  const leftover = readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS);
  await db.put("settings", leftover, SETTINGS_KEY);
  clearLocalStorage(SETTINGS_FALLBACK_KEY);
}

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
      await reconcileIfNeeded(db);
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
      await reconcileIfNeeded(db);
      await db.put("settings", settings, SETTINGS_KEY);
    } catch {
      activateStorageFallback();
      writeLocalStorage(SETTINGS_FALLBACK_KEY, settings);
    }
  }
}
