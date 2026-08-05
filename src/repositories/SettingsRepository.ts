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
  // ponytail: 다른 탭이 이 사이 마커를 지웠으면(예: 백업 가져오기가 최신 settings로
  // 덮어쓰고 마커도 지운 경우) 방금 읽은 오래된 값을 다시 쓰지 않는다. 완벽한 탭간
  // 락은 아니고 창을 좁히는 수준 — 필요해지면 마커 자체를 IndexedDB로 옮겨서
  // 트랜잭션으로 보호.
  if (!hasLocalStorageData(SETTINGS_FALLBACK_KEY)) return;
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
      return existing ? { ...DEFAULT_SETTINGS, ...existing } : DEFAULT_SETTINGS;
    } catch {
      noteFallbackTriggered();
      return { ...DEFAULT_SETTINGS, ...readLocalStorage(SETTINGS_FALLBACK_KEY, DEFAULT_SETTINGS) };
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
