import { getDb } from "./db";
import { isSameLocalDay } from "@/lib/timer";
import type { Attempt, DashboardSummary, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import {
  activateStorageFallback,
  isStorageFallbackActive,
  readLocalStorage,
  removeLocalStorageRecord,
  upsertLocalStorageRecord,
  writeLocalStorage,
} from "./storageFallback";

const WRONG_NOTES_KEY = "wrongnotes_fallback";
const FAVORITES_KEY = "favorites_fallback";

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
    try {
      const db = await getDb();
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
      activateStorageFallback();
    }
  }

  async getAttempts(questionId?: string): Promise<Attempt[]> {
    if (isStorageFallbackActive()) return [];
    try {
      const db = await getDb();
      if (questionId) {
        return db.getAllFromIndex("attempts", "questionId", questionId);
      }
      return db.getAll("attempts");
    } catch {
      activateStorageFallback();
      return [];
    }
  }

  async getQuestionStats(questionId: string): Promise<QuestionStats> {
    const empty: QuestionStats = { questionId, correctCount: 0, wrongCount: 0, lastSolvedAt: 0 };
    if (isStorageFallbackActive()) return empty;
    try {
      const db = await getDb();
      const existing = await db.get("questionStats", questionId);
      return existing ?? empty;
    } catch {
      activateStorageFallback();
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
      return db.getAll("wrongNotes");
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
      return db.getAll("favorites");
    } catch {
      activateStorageFallback();
      return Object.values(readLocalStorage<Record<string, Favorite>>(FAVORITES_KEY, {}));
    }
  }

  async removeWrongNote(questionId: string): Promise<void> {
    if (isStorageFallbackActive()) {
      removeLocalStorageRecord(WRONG_NOTES_KEY, questionId);
      return;
    }
    try {
      const db = await getDb();
      await db.delete("wrongNotes", questionId);
    } catch {
      activateStorageFallback();
      removeLocalStorageRecord(WRONG_NOTES_KEY, questionId);
    }
  }

  async removeFavorite(questionId: string): Promise<void> {
    if (isStorageFallbackActive()) {
      removeLocalStorageRecord(FAVORITES_KEY, questionId);
      return;
    }
    try {
      const db = await getDb();
      await db.delete("favorites", questionId);
    } catch {
      activateStorageFallback();
      removeLocalStorageRecord(FAVORITES_KEY, questionId);
    }
  }

  async resetAll(): Promise<void> {
    writeLocalStorage(WRONG_NOTES_KEY, {});
    writeLocalStorage(FAVORITES_KEY, {});
    if (isStorageFallbackActive()) return;
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
    } catch {
      activateStorageFallback();
    }
  }
}
