import { getDb } from "./db";
import { isSameLocalDay } from "@/lib/timer";
import type { Attempt, DashboardSummary, Favorite, QuestionStats, WrongNote } from "@/types/progress";

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
  }

  async getAttempts(questionId?: string): Promise<Attempt[]> {
    const db = await getDb();
    if (questionId) {
      return db.getAllFromIndex("attempts", "questionId", questionId);
    }
    return db.getAll("attempts");
  }

  async getQuestionStats(questionId: string): Promise<QuestionStats> {
    const db = await getDb();
    const existing = await db.get("questionStats", questionId);
    return (
      existing ?? {
        questionId,
        correctCount: 0,
        wrongCount: 0,
        lastSolvedAt: 0,
      }
    );
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
    const db = await getDb();
    await db.put("wrongNotes", { questionId, addedAt: Date.now() });
  }

  async addFavorite(questionId: string): Promise<void> {
    const db = await getDb();
    await db.put("favorites", { questionId, addedAt: Date.now() });
  }

  async getWrongNotes(): Promise<WrongNote[]> {
    const db = await getDb();
    return db.getAll("wrongNotes");
  }

  async getFavorites(): Promise<Favorite[]> {
    const db = await getDb();
    return db.getAll("favorites");
  }

  async removeWrongNote(questionId: string): Promise<void> {
    const db = await getDb();
    await db.delete("wrongNotes", questionId);
  }

  async removeFavorite(questionId: string): Promise<void> {
    const db = await getDb();
    await db.delete("favorites", questionId);
  }

  async resetAll(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["attempts", "questionStats", "wrongNotes", "favorites"], "readwrite");
    await Promise.all([
      tx.objectStore("attempts").clear(),
      tx.objectStore("questionStats").clear(),
      tx.objectStore("wrongNotes").clear(),
      tx.objectStore("favorites").clear(),
    ]);
    await tx.done;
  }
}
