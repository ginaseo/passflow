import { getDb } from "./db";
import type { Attempt, DashboardSummary, QuestionStats } from "@/types/progress";

export interface ProgressRepository {
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(questionId?: string): Promise<Attempt[]>;
  getQuestionStats(questionId: string): Promise<QuestionStats>;
  getDashboardSummary(): Promise<DashboardSummary>;
  addWrongNote(questionId: string): Promise<void>;
  addFavorite(questionId: string): Promise<void>;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
    const today = attempts.filter((a) => now - a.solvedAt < ONE_DAY_MS);

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
}
