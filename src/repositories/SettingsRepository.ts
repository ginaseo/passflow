import { getDb } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import {
  activateStorageFallback,
  clearLocalStorage,
  deactivateStorageFallback,
  hasLocalStorageData,
  readLocalStorage,
  writeLocalStorage,
} from "./storageFallback";

const SETTINGS_KEY = "app";
const SETTINGS_FALLBACK_KEY = "settings_fallback";

let reconcilePromise: Promise<void> | null = null;

function reconcileIfNeeded(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (!reconcilePromise) {
    reconcilePromise = doReconcile(db);
  }
  return reconcilePromise;
}

async function doReconcile(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (!hasLocalStorageData(SETTINGS_FALLBACK_KEY)) return;
  const leftover = readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS);
  await db.put("settings", leftover, SETTINGS_KEY);
  clearLocalStorage(SETTINGS_FALLBACK_KEY);
}

function noteFallbackTriggered(): void {
  activateStorageFallback();
  reconcilePromise = null;
}

export interface SettingsRepository {
  getSettings(): Promise<Settings>;
  updateSettings(settings: Settings): Promise<void>;
}

export class IndexedDbSettingsRepository implements SettingsRepository {
  async getSettings(): Promise<Settings> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateStorageFallback();
      const existing = await db.get("settings", SETTINGS_KEY);
      return existing ?? DEFAULT_SETTINGS;
    } catch {
      noteFallbackTriggered();
      return readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS);
    }
  }

  async updateSettings(settings: Settings): Promise<void> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateStorageFallback();
      await db.put("settings", settings, SETTINGS_KEY);
    } catch {
      noteFallbackTriggered();
      writeLocalStorage(SETTINGS_FALLBACK_KEY, settings);
    }
  }
}
