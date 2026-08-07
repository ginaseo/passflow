import { getDb, invalidateDb } from "./db";
import { isSameLocalDay } from "@/lib/timer";
import { dedupeAttemptsBySession } from "@/lib/attempts";
import type { Attempt, DashboardSummary, Favorite, Mode, QuestionStats, WrongNote } from "@/types/progress";
import type { Settings } from "@/types/settings";
import { SETTINGS_KEY, clearSettingsFallback } from "./SettingsRepository";
import {
  activateStorageFallback,
  clearLocalStorage,
  deactivateStorageFallback,
  hasLocalStorageData,
  readLocalStorage,
  removeLocalStorageRecord,
  upsertLocalStorageRecord,
  writeLocalStorage,
} from "./storageFallback";

const WRONG_NOTES_KEY = "wrongnotes_fallback";
const FAVORITES_KEY = "favorites_fallback";
const WRONG_NOTES_TOMBSTONES_KEY = "wrongnotes_tombstones";
const FAVORITES_TOMBSTONES_KEY = "favorites_tombstones";
const RESET_PENDING_KEY = "reset_pending";
const ATTEMPTS_DEDUPED_KEY = "attempts_deduped_v1";

let reconcilePromise: Promise<void> | null = null;

function reconcileIfNeeded(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (!reconcilePromise) {
    reconcilePromise = doReconcile(db);
  }
  return reconcilePromise;
}

async function doReconcile(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  if (readLocalStorage(RESET_PENDING_KEY, false)) {
    const tx = db.transaction(["attempts", "questionStats", "wrongNotes", "favorites"], "readwrite");
    await Promise.all([
      tx.objectStore("attempts").clear(),
      tx.objectStore("questionStats").clear(),
      tx.objectStore("wrongNotes").clear(),
      tx.objectStore("favorites").clear(),
    ]);
    await tx.done;
    clearLocalStorage(RESET_PENDING_KEY);
  }

  // #41 이전 코드는 시험모드 재선택마다 별개 attempt row를 쌓았다 — 그 흔적으로 남은
  // (questionId, sessionId) 중복 row와, 거기서 비롯된 부풀려진 questionStats를 딱
  // 한 번만 정리한다(#45). 이후 recordAttempt/importBackup은 스스로 중복을 안 만든다.
  // attempts/questionStats는 폴백 대상이 아니므로(recordAttempt와 동일한 원칙), 이
  // 블록이 실패해도 wrongNotes/favorites 쪽 reconcile까지 전역 폴백으로 끌고가지
  // 않는다 — 플래그가 안 세워지므로 다음 앱 로드 때 다시 시도된다.
  if (!readLocalStorage(ATTEMPTS_DEDUPED_KEY, false)) {
    try {
      const tx = db.transaction(["attempts", "questionStats"], "readwrite");
      const attemptsStore = tx.objectStore("attempts");
      const statsStore = tx.objectStore("questionStats");

      const all = await attemptsStore.getAll();
      const { kept, removedIds } = dedupeAttemptsBySession(all);
      for (const id of removedIds) await attemptsStore.delete(id);

      const byQuestion = new Map<string, Attempt[]>();
      for (const a of kept) {
        const list = byQuestion.get(a.questionId) ?? [];
        list.push(a);
        byQuestion.set(a.questionId, list);
      }
      await statsStore.clear();
      for (const [questionId, list] of byQuestion) {
        const correctCount = list.filter((a) => a.isCorrect).length;
        const wrongCount = list.length - correctCount;
        const lastSolvedAt = list.reduce((max, a) => Math.max(max, a.solvedAt), 0);
        await statsStore.put({ questionId, correctCount, wrongCount, lastSolvedAt });
      }

      await tx.done;
      writeLocalStorage(ATTEMPTS_DEDUPED_KEY, true);
    } catch {
      // 조용히 건너뛴다 — 위 주석 참고.
    }
  }

  if (hasLocalStorageData(WRONG_NOTES_TOMBSTONES_KEY)) {
    const tombstoned = readLocalStorage<Record<string, true>>(WRONG_NOTES_TOMBSTONES_KEY, {});
    const tx = db.transaction("wrongNotes", "readwrite");
    await Promise.all(Object.keys(tombstoned).map((id) => tx.store.delete(id)));
    await tx.done;
    clearLocalStorage(WRONG_NOTES_TOMBSTONES_KEY);
  }
  if (hasLocalStorageData(FAVORITES_TOMBSTONES_KEY)) {
    const tombstoned = readLocalStorage<Record<string, true>>(FAVORITES_TOMBSTONES_KEY, {});
    const tx = db.transaction("favorites", "readwrite");
    await Promise.all(Object.keys(tombstoned).map((id) => tx.store.delete(id)));
    await tx.done;
    clearLocalStorage(FAVORITES_TOMBSTONES_KEY);
  }

  if (hasLocalStorageData(WRONG_NOTES_KEY)) {
    const notes = readLocalStorage<Record<string, WrongNote>>(WRONG_NOTES_KEY, {});
    const tx = db.transaction("wrongNotes", "readwrite");
    await Promise.all(Object.values(notes).map((note) => tx.store.put(note)));
    await tx.done;
    clearLocalStorage(WRONG_NOTES_KEY);
  }
  if (hasLocalStorageData(FAVORITES_KEY)) {
    const favorites = readLocalStorage<Record<string, Favorite>>(FAVORITES_KEY, {});
    const tx = db.transaction("favorites", "readwrite");
    await Promise.all(Object.values(favorites).map((favorite) => tx.store.put(favorite)));
    await tx.done;
    clearLocalStorage(FAVORITES_KEY);
  }
}

function noteFallbackTriggered(): void {
  activateStorageFallback();
  reconcilePromise = null;
  invalidateDb();
}

function hasPendingFallbackData(): boolean {
  return (
    hasLocalStorageData(WRONG_NOTES_KEY) ||
    hasLocalStorageData(FAVORITES_KEY) ||
    hasLocalStorageData(WRONG_NOTES_TOMBSTONES_KEY) ||
    hasLocalStorageData(FAVORITES_TOMBSTONES_KEY) ||
    readLocalStorage(RESET_PENDING_KEY, false)
  );
}

function deactivateIfFullyRecovered(): void {
  if (!hasPendingFallbackData()) {
    deactivateStorageFallback();
  }
}

export interface ProgressRepository {
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(questionId?: string): Promise<Attempt[]>;
  getQuestionStats(questionId: string): Promise<QuestionStats>;
  getDashboardSummary(): Promise<DashboardSummary>;
  addWrongNote(questionId: string, mode: Mode): Promise<void>;
  addFavorite(questionId: string): Promise<void>;
  getWrongNotes(): Promise<WrongNote[]>;
  getFavorites(): Promise<Favorite[]>;
  removeWrongNote(questionId: string): Promise<void>;
  removeFavorite(questionId: string): Promise<void>;
  resetAll(): Promise<void>;
  importBackup(data: {
    attempts: Omit<Attempt, "id">[];
    wrongNotes: WrongNote[];
    favorites: Favorite[];
    settings: Settings;
  }): Promise<void>;
}

export class IndexedDbProgressRepository implements ProgressRepository {
  async recordAttempt(attempt: Omit<Attempt, "id">): Promise<void> {
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
    } catch {
      noteFallbackTriggered();
      return;
    }
    try {
      const tx = db.transaction(["attempts", "questionStats"], "readwrite");
      const attemptsStore = tx.objectStore("attempts");

      // 같은 세션에서 같은 문항을 재선택(시험모드는 답을 자유롭게 바꿀 수 있음)하면
      // 별개 시도로 또 쌓지 않는다 — 그래야 questionStats/대시보드 정답률이 재선택
      // 횟수만큼 부풀려지지 않는다. 다른 세션(다른 날 재풀이)은 그대로 누적.
      // #41 이전 코드가 만들어둔 구버전 중복 row가 남아있을 수도 있어(#45), 하나가
      // 아니라 매칭되는 전부를 찾아 지운다 — 이 문항이 다시 손닿을 때 자연스럽게 정리된다.
      const sameQuestion = await attemptsStore.index("questionId").getAll(attempt.questionId);
      const duplicates = sameQuestion.filter((a) => a.sessionId === attempt.sessionId);

      const statsStore = tx.objectStore("questionStats");
      const next: QuestionStats = (await statsStore.get(attempt.questionId)) ?? {
        questionId: attempt.questionId,
        correctCount: 0,
        wrongCount: 0,
        lastSolvedAt: 0,
      };

      for (const dup of duplicates) {
        if (dup.isCorrect) next.correctCount -= 1;
        else next.wrongCount -= 1;
        await attemptsStore.delete(dup.id!);
      }
      await attemptsStore.add(attempt as Attempt);

      if (attempt.isCorrect) next.correctCount += 1;
      else next.wrongCount += 1;
      next.lastSolvedAt = attempt.solvedAt;
      await statsStore.put(next);

      await tx.done;
    } catch {
      // attempts/questionStats는 폴백 대상이 아님 — 이 쓰기만 조용히 실패, 다른 스토어엔 전파 안 함
    }
  }

  async getAttempts(questionId?: string): Promise<Attempt[]> {
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
    } catch {
      noteFallbackTriggered();
      return [];
    }
    try {
      if (questionId) {
        return await db.getAllFromIndex("attempts", "questionId", questionId);
      }
      return await db.getAll("attempts");
    } catch {
      return [];
    }
  }

  async getQuestionStats(questionId: string): Promise<QuestionStats> {
    const empty: QuestionStats = { questionId, correctCount: 0, wrongCount: 0, lastSolvedAt: 0 };
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
    } catch {
      noteFallbackTriggered();
      return empty;
    }
    try {
      const existing = await db.get("questionStats", questionId);
      return existing ?? empty;
    } catch {
      return empty;
    }
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const attempts = await this.getAttempts();
    const now = Date.now();
    const today = attempts.filter((a) => isSameLocalDay(a.solvedAt, now));

    const accuracy = (list: Attempt[]) =>
      list.length === 0 ? 0 : list.filter((a) => a.isCorrect).length / list.length;

    return {
      todayCount: today.length,
      todayAccuracy: accuracy(today),
      totalCount: attempts.length,
      totalAccuracy: accuracy(attempts),
    };
  }

  async addWrongNote(questionId: string, mode: Mode): Promise<void> {
    // mode는 "이 문항을 최초로 틀린 모드"를 뜻한다 — 이후 리뷰 탭에서 study 모드로
    // 다시풀기해서 또 틀려도 여기서 덮어쓰지 않는다. 덮어쓰면 시험모드 회차에서
    // 틀린 문항이 조용히 study로 재분류돼 대시보드의 회차별 오답 집계가 깨진다.
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      const existing = await db.get("wrongNotes", questionId);
      const note: WrongNote = { questionId, addedAt: Date.now(), mode: existing?.mode ?? mode };
      await db.put("wrongNotes", note);
    } catch {
      noteFallbackTriggered();
      const existing = readLocalStorage<Record<string, WrongNote>>(WRONG_NOTES_KEY, {})[questionId];
      const note: WrongNote = { questionId, addedAt: Date.now(), mode: existing?.mode ?? mode };
      upsertLocalStorageRecord(WRONG_NOTES_KEY, questionId, note);
    }
  }

  async addFavorite(questionId: string): Promise<void> {
    const favorite: Favorite = { questionId, addedAt: Date.now() };
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      await db.put("favorites", favorite);
    } catch {
      noteFallbackTriggered();
      upsertLocalStorageRecord(FAVORITES_KEY, questionId, favorite);
    }
  }

  async getWrongNotes(): Promise<WrongNote[]> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      return await db.getAll("wrongNotes");
    } catch {
      noteFallbackTriggered();
      return Object.values(readLocalStorage<Record<string, WrongNote>>(WRONG_NOTES_KEY, {}));
    }
  }

  async getFavorites(): Promise<Favorite[]> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      return await db.getAll("favorites");
    } catch {
      noteFallbackTriggered();
      return Object.values(readLocalStorage<Record<string, Favorite>>(FAVORITES_KEY, {}));
    }
  }

  async removeWrongNote(questionId: string): Promise<void> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      await db.delete("wrongNotes", questionId);
    } catch {
      noteFallbackTriggered();
      removeLocalStorageRecord(WRONG_NOTES_KEY, questionId);
      upsertLocalStorageRecord(WRONG_NOTES_TOMBSTONES_KEY, questionId, true);
    }
  }

  async removeFavorite(questionId: string): Promise<void> {
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      deactivateIfFullyRecovered();
      await db.delete("favorites", questionId);
    } catch {
      noteFallbackTriggered();
      removeLocalStorageRecord(FAVORITES_KEY, questionId);
      upsertLocalStorageRecord(FAVORITES_TOMBSTONES_KEY, questionId, true);
    }
  }

  async resetAll(): Promise<void> {
    writeLocalStorage(WRONG_NOTES_KEY, {});
    writeLocalStorage(FAVORITES_KEY, {});
    writeLocalStorage(WRONG_NOTES_TOMBSTONES_KEY, {});
    writeLocalStorage(FAVORITES_TOMBSTONES_KEY, {});
    writeLocalStorage(RESET_PENDING_KEY, true);
    try {
      const db = await getDb();
      const tx = db.transaction(["attempts", "questionStats", "wrongNotes", "favorites"], "readwrite");
      await Promise.all([
        tx.objectStore("attempts").clear(),
        tx.objectStore("questionStats").clear(),
        tx.objectStore("wrongNotes").clear(),
        tx.objectStore("favorites").clear(),
      ]);
      await tx.done;
      clearLocalStorage(RESET_PENDING_KEY);
      deactivateIfFullyRecovered();
    } catch {
      noteFallbackTriggered();
    }
  }

  async importBackup(data: {
    attempts: Omit<Attempt, "id">[];
    wrongNotes: WrongNote[];
    favorites: Favorite[];
    settings: Settings;
  }): Promise<void> {
    const db = await getDb();
    await reconcileIfNeeded(db);
    const tx = db.transaction(
      ["attempts", "questionStats", "wrongNotes", "favorites", "settings"],
      "readwrite"
    );

    const attemptsStore = tx.objectStore("attempts");
    const statsStore = tx.objectStore("questionStats");
    const wrongNotesStore = tx.objectStore("wrongNotes");
    const favoritesStore = tx.objectStore("favorites");
    const settingsStore = tx.objectStore("settings");

    // 같은 문제를 같은 시각에 같은 세션에서 푼 기록은 동일 풀이로 취급한다 —
    // 같은 백업 파일을 실수로(또는 확인차) 두 번 가져와도 풀이수가 배로 부풀지 않게.
    const attemptKey = (a: { solvedAt: number; sessionId?: string }) => `${a.solvedAt}|${a.sessionId ?? ""}`;

    const affectedQuestionIds = new Set(data.attempts.map((a) => a.questionId));
    const existingKeysByQuestion = new Map<string, Set<string>>();
    for (const questionId of affectedQuestionIds) {
      const existing = await attemptsStore.index("questionId").getAll(questionId);
      existingKeysByQuestion.set(questionId, new Set(existing.map(attemptKey)));
    }

    for (const attempt of data.attempts) {
      const keys = existingKeysByQuestion.get(attempt.questionId)!;
      const key = attemptKey(attempt);
      if (keys.has(key)) continue;
      keys.add(key);
      await attemptsStore.add(attempt as Attempt);
    }
    for (const note of data.wrongNotes) {
      await wrongNotesStore.put(note);
    }
    for (const favorite of data.favorites) {
      await favoritesStore.put(favorite);
    }
    await settingsStore.put(data.settings, SETTINGS_KEY);

    for (const questionId of affectedQuestionIds) {
      const questionAttempts = await attemptsStore.index("questionId").getAll(questionId);
      // 가져온 백업 자체가 #41 이전 구버전 데이터를 담고 있을 수 있어(#45), 여기서도
      // (questionId, sessionId) 중복을 정리한 뒤 통계를 계산한다.
      const { kept, removedIds } = dedupeAttemptsBySession(questionAttempts);
      for (const id of removedIds) await attemptsStore.delete(id);
      const correctCount = kept.filter((a) => a.isCorrect).length;
      const wrongCount = kept.length - correctCount;
      const lastSolvedAt = kept.reduce((max, a) => Math.max(max, a.solvedAt), 0);
      await statsStore.put({ questionId, correctCount, wrongCount, lastSolvedAt });
    }

    await tx.done;
    clearSettingsFallback();
  }
}
