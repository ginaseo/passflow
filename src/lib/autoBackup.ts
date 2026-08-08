import { parseBackup, serializeBackup, type Backup } from "./backup";
import type { Attempt, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import type { Settings } from "@/types/settings";

export const AUTO_BACKUP_KEY = "pf_auto_backup";

export function writeAutoBackup(data: {
  attempts: Attempt[];
  questionStats: QuestionStats[];
  wrongNotes: WrongNote[];
  favorites: Favorite[];
  settings: Settings;
}): void {
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, serializeBackup(data));
  } catch {
    // 자동 백업은 최선 노력이지 필수 경로가 아니다 — localStorage 용량 초과 등은 조용히 건너뛴다.
  }
}

export function clearAutoBackup(): void {
  try {
    localStorage.removeItem(AUTO_BACKUP_KEY);
  } catch {
    // 최선 노력 — 실패해도 조용히 건너뛴다.
  }
}

export function readAutoBackup(): Backup | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(AUTO_BACKUP_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  return parseBackup(raw);
}
