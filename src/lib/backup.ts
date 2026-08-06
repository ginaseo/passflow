import type { Attempt, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

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
      entryType: a.entryType,
      selectedAnswer: a.selectedAnswer,
      isCorrect: a.isCorrect,
      solveTimeMs: a.solveTimeMs,
      sessionId: a.sessionId,
      timeLimitMs: a.timeLimitMs,
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
    (s.timeoutBehavior === "wrong" || s.timeoutBehavior === "warn" || s.timeoutBehavior === "ignore") &&
    (s.reviewOrder === undefined || s.reviewOrder === "sequential" || s.reviewOrder === "random")
  );
}

// isValidSettings는 reviewOrder가 없는 것도 통과시키므로(구버전 백업 호환),
// 통과된 값이라도 필드가 실제로 비어 있을 수 있다 — 소비자에게 넘기기 전에
// 여기서 채워 넣는다. normalizeAttempt와 같은 이유로 파싱 경계에서 정규화한다.
function normalizeSettings(value: Settings): Settings {
  return { ...DEFAULT_SETTINGS, ...value };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// id는 절대 복사하지 않는다 — IndexedDB의 attempts 스토어는 autoIncrement 키라서,
// 백업 파일에 남아있는(또는 사용자가 손으로 넣은) id가 기존 레코드와 충돌하면
// importBackup의 트랜잭션 전체가 abort된다.
//
// entryType은 이 필드가 생기기 전에 만들어진 백업(BACKUP_VERSION은 그대로 1)에는
// 아예 없을 수 있다 — 없거나 값이 유효하지 않으면 그 attempt 전체를 거부하는 대신
// "round"로 채워 넣는다. 이 앱에서 시험모드+랜덤 조합이 실사용된 이력이 없어
// round가 안전한 기본값이다.
function normalizeAttempt(value: unknown): Omit<Attempt, "id"> | null {
  if (typeof value !== "object" || value === null) return null;
  const a = value as Record<string, unknown>;
  if (
    typeof a.questionId !== "string" ||
    !isFiniteNumber(a.solvedAt) ||
    (a.mode !== "study" && a.mode !== "exam") ||
    !isFiniteNumber(a.selectedAnswer) ||
    typeof a.isCorrect !== "boolean" ||
    !isFiniteNumber(a.solveTimeMs) ||
    typeof a.sessionId !== "string" ||
    (a.timeLimitMs !== undefined && a.timeLimitMs !== null && !isFiniteNumber(a.timeLimitMs))
  ) {
    return null;
  }
  return {
    questionId: a.questionId,
    solvedAt: a.solvedAt,
    mode: a.mode,
    entryType: a.entryType === "round" || a.entryType === "random" ? a.entryType : "round",
    selectedAnswer: a.selectedAnswer,
    isCorrect: a.isCorrect,
    solveTimeMs: a.solveTimeMs,
    sessionId: a.sessionId,
    timeLimitMs: isFiniteNumber(a.timeLimitMs) ? a.timeLimitMs : null,
  };
}

function normalizeQuestionStats(value: unknown): QuestionStats | null {
  if (typeof value !== "object" || value === null) return null;
  const s = value as Record<string, unknown>;
  if (
    typeof s.questionId !== "string" ||
    !isFiniteNumber(s.correctCount) ||
    !isFiniteNumber(s.wrongCount) ||
    !isFiniteNumber(s.lastSolvedAt)
  ) {
    return null;
  }
  return {
    questionId: s.questionId,
    correctCount: s.correctCount,
    wrongCount: s.wrongCount,
    lastSolvedAt: s.lastSolvedAt,
  };
}

function normalizeWrongNote(value: unknown): WrongNote | null {
  if (typeof value !== "object" || value === null) return null;
  const n = value as Record<string, unknown>;
  if (typeof n.questionId !== "string" || !isFiniteNumber(n.addedAt) || (n.mode !== "study" && n.mode !== "exam")) {
    return null;
  }
  return { questionId: n.questionId, addedAt: n.addedAt, mode: n.mode };
}

function normalizeFavorite(value: unknown): Favorite | null {
  if (typeof value !== "object" || value === null) return null;
  const f = value as Record<string, unknown>;
  if (typeof f.questionId !== "string" || !isFiniteNumber(f.addedAt)) return null;
  return { questionId: f.questionId, addedAt: f.addedAt };
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
    !isFiniteNumber(obj.exportedAt) ||
    !Array.isArray(obj.attempts) ||
    !Array.isArray(obj.questionStats) ||
    !Array.isArray(obj.wrongNotes) ||
    !Array.isArray(obj.favorites) ||
    !isValidSettings(obj.settings)
  ) {
    return null;
  }

  const attempts = obj.attempts.map(normalizeAttempt);
  const questionStats = obj.questionStats.map(normalizeQuestionStats);
  const wrongNotes = obj.wrongNotes.map(normalizeWrongNote);
  const favorites = obj.favorites.map(normalizeFavorite);

  if (
    attempts.some((a) => a === null) ||
    questionStats.some((s) => s === null) ||
    wrongNotes.some((n) => n === null) ||
    favorites.some((f) => f === null)
  ) {
    return null;
  }

  return {
    version: obj.version,
    exportedAt: obj.exportedAt,
    attempts: attempts as Omit<Attempt, "id">[],
    questionStats: questionStats as QuestionStats[],
    wrongNotes: wrongNotes as WrongNote[],
    favorites: favorites as Favorite[],
    settings: normalizeSettings(obj.settings),
  };
}
