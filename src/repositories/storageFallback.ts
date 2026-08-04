const PREFIX = "pf_";

let fallbackActive = false;
const listeners = new Set<() => void>();

export function isStorageFallbackActive(): boolean {
  return fallbackActive;
}

export function activateStorageFallback(): void {
  if (fallbackActive) return;
  fallbackActive = true;
  console.warn("[storageFallback] IndexedDB 사용 불가 — localStorage로 폴백합니다.");
  listeners.forEach((listener) => listener());
}

export function deactivateStorageFallback(): void {
  if (!fallbackActive) return;
  fallbackActive = false;
  listeners.forEach((listener) => listener());
}

export function subscribeStorageFallback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage 자체도 막힌 극단 케이스 — 폴백의 폴백은 스코프 밖(설계문서 참고)
  }
}

export function upsertLocalStorageRecord<T>(key: string, id: string, value: T): void {
  const record = readLocalStorage<Record<string, T>>(key, {});
  record[id] = value;
  writeLocalStorage(key, record);
}

export function removeLocalStorageRecord(key: string, id: string): void {
  const record = readLocalStorage<Record<string, unknown>>(key, {});
  delete record[id];
  writeLocalStorage(key, record);
}

export function hasLocalStorageData(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null;
  } catch {
    return false;
  }
}

export function clearLocalStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // no-op
  }
}
