import type { Attempt, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import type { Settings } from "@/types/settings";

export const BACKUP_VERSION = 1;

export interface Backup {
  version: number;
  exportedAt: number;
  attempts: Omit<Attempt, "id">[];
  questionStats: QuestionStats[];
  wrongNotes: WrongNote[];
  favorites: Favorite[];
  settings: Settings;
}

export function serializeBackup(data: {
  attempts: Attempt[];
  questionStats: QuestionStats[];
  wrongNotes: WrongNote[];
  favorites: Favorite[];
  settings: Settings;
}): string {
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    attempts: data.attempts.map((a) => ({
      questionId: a.questionId,
      solvedAt: a.solvedAt,
      mode: a.mode,
      selectedAnswer: a.selectedAnswer,
      isCorrect: a.isCorrect,
      solveTimeMs: a.solveTimeMs,
      sessionId: a.sessionId,
    })),
    questionStats: data.questionStats,
    wrongNotes: data.wrongNotes,
    favorites: data.favorites,
    settings: data.settings,
  };
  return JSON.stringify(backup, null, 2);
}

function isValidSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.autoSaveWrongNotes === "boolean" &&
    (s.defaultMode === "study" || s.defaultMode === "exam") &&
    (s.timeoutBehavior === "wrong" || s.timeoutBehavior === "warn" || s.timeoutBehavior === "ignore")
  );
}

export function parseBackup(text: string): Backup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== BACKUP_VERSION) return null;
  if (
    !Array.isArray(obj.attempts) ||
    !Array.isArray(obj.questionStats) ||
    !Array.isArray(obj.wrongNotes) ||
    !Array.isArray(obj.favorites) ||
    !isValidSettings(obj.settings)
  ) {
    return null;
  }

  return obj as unknown as Backup;
}
