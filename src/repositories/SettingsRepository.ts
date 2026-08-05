import { getDb, invalidateDb } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";
import {
  activateStorageFallback,
  clearLocalStorage,
  deactivateStorageFallback,
  hasLocalStorageData,
  readLocalStorage,
  writeLocalStorage,
} from "./storageFallback";

export const SETTINGS_KEY = "app";
const SETTINGS_FALLBACK_KEY = "settings_fallback";

// importBackup이 settings를 attempts/wrongNotes/favorites와 같은 IndexedDB
// 트랜잭션에 넣을 때, 남아있던 폴백 데이터가 나중에 reconcile되며 방금 가져온
// settings를 덮어쓰지 않도록 미리 지워둔다.
export function clearSettingsFallback(): void {
  clearLocalStorage(SETTINGS_FALLBACK_KEY);
}

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
  invalidateDb();
}

function deactivateIfFullyRecovered(): void {
  if (!hasLocalStorageData(SETTINGS_FALLBACK_KEY)) {
    deactivateStorageFallback();
  }
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
      deactivateIfFullyRecovered();
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
      deactivateIfFullyRecovered();
      await db.put("settings", settings, SETTINGS_KEY);
    } catch {
      noteFallbackTriggered();
      writeLocalStorage(SETTINGS_FALLBACK_KEY, settings);
    }
  }
}
