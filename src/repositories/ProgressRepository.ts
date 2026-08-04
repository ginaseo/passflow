import { getDb } from "./db";
import { isSameLocalDay } from "@/lib/timer";
import type { Attempt, DashboardSummary, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import {
  activateStorageFallback,
  clearLocalStorage,
  hasLocalStorageData,
  isStorageFallbackActive,
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

export interface ProgressRepository {
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(questionId?: string): Promise<Attempt[]>;
  getQuestionStats(questionId: string): Promise<QuestionStats>;
  getDashboardSummary(): Promise<DashboardSummary>;
  addWrongNote(questionId: string): Promise<void>;
  addFavorite(questionId: string): Promise<void>;
  getWrongNotes(): Promise<WrongNote[]>;
  getFavorites(): Promise<Favorite[]>;
  removeWrongNote(questionId: string): Promise<void>;
  removeFavorite(questionId: string): Promise<void>;
  resetAll(): Promise<void>;
}

export class IndexedDbProgressRepository implements ProgressRepository {
  async recordAttempt(attempt: Omit<Attempt, "id">): Promise<void> {
    if (isStorageFallbackActive()) return;
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
    } catch {
      activateStorageFallback();
      return;
    }
    try {
      const tx = db.transaction(["attempts", "questionStats"], "readwrite");

      await tx.objectStore("attempts").add(attempt as Attempt);

      const statsStore = tx.objectStore("questionStats");
      const existing = await statsStore.get(attempt.questionId);
      const next: QuestionStats = existing ?? {
        questionId: attempt.questionId,
        correctCount: 0,
        wrongCount: 0,
        lastSolvedAt: 0,
      };
      if (attempt.isCorrect) {
        next.correctCount += 1;
      } else {
        next.wrongCount += 1;
      }
      next.lastSolvedAt = attempt.solvedAt;
      await statsStore.put(next);

      await tx.done;
    } catch {
      // attempts/questionStats는 폴백 대상이 아님 — 이 쓰기만 조용히 실패, 다른 스토어엔 전파 안 함
    }
  }

  async getAttempts(questionId?: string): Promise<Attempt[]> {
    if (isStorageFallbackActive()) return [];
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
    } catch {
      activateStorageFallback();
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
    if (isStorageFallbackActive()) return empty;
    let db;
    try {
      db = await getDb();
      await reconcileIfNeeded(db);
    } catch {
      activateStorageFallback();
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

  async addWrongNote(questionId: string): Promise<void> {
    const note: WrongNote = { questionId, addedAt: Date.now() };
    if (isStorageFallbackActive()) {
      upsertLocalStorageRecord(WRONG_NOTES_KEY, questionId, note);
      return;
    }
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      await db.put("wrongNotes", note);
    } catch {
      activateStorageFallback();
      upsertLocalStorageRecord(WRONG_NOTES_KEY, questionId, note);
    }
  }

  async addFavorite(questionId: string): Promise<void> {
    const favorite: Favorite = { questionId, addedAt: Date.now() };
    if (isStorageFallbackActive()) {
      upsertLocalStorageRecord(FAVORITES_KEY, questionId, favorite);
      return;
    }
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      await db.put("favorites", favorite);
    } catch {
      activateStorageFallback();
      upsertLocalStorageRecord(FAVORITES_KEY, questionId, favorite);
    }
  }

  async getWrongNotes(): Promise<WrongNote[]> {
    if (isStorageFallbackActive()) {
      return Object.values(readLocalStorage<Record<string, WrongNote>>(WRONG_NOTES_KEY, {}));
    }
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      return await db.getAll("wrongNotes");
    } catch {
      activateStorageFallback();
      return Object.values(readLocalStorage<Record<string, WrongNote>>(WRONG_NOTES_KEY, {}));
    }
  }

  async getFavorites(): Promise<Favorite[]> {
    if (isStorageFallbackActive()) {
      return Object.values(readLocalStorage<Record<string, Favorite>>(FAVORITES_KEY, {}));
    }
    try {
      const db = await getDb();
      await reconcileIfNeeded(db);
      return await db.getAll("favorites");
    } catch {
      activateStorageFallback();
      return Object.values(readLocalStorage<Record<string, Favorite>>(FAVORITES_KEY, {}));
    }
  }

  async removeWrongNote(questionId: string): Promise<void> {
    if (isStorageFallbackActive()) {
      removeLocalStorageRecord(WRONG_NOTES_KEY, questionId);
      upsertLocalStorageRecord(WRONG_NOTES_TOMBSTONES_KEY, questionId, true);
      return;
    }
    try {
      const db = await getDb();
      await db.delete("wrongNotes", questionId);
    } catch {
      activateStorageFallback();
      removeLocalStorageRecord(WRONG_NOTES_KEY, questionId);
      upsertLocalStorageRecord(WRONG_NOTES_TOMBSTONES_KEY, questionId, true);
    }
  }

  async removeFavorite(questionId: string): Promise<void> {
    if (isStorageFallbackActive()) {
      removeLocalStorageRecord(FAVORITES_KEY, questionId);
      upsertLocalStorageRecord(FAVORITES_TOMBSTONES_KEY, questionId, true);
      return;
    }
    try {
      const db = await getDb();
      await db.delete("favorites", questionId);
    } catch {
      activateStorageFallback();
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
    } catch {
      activateStorageFallback();
    }
  }
}
