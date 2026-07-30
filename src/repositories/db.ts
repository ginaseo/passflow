import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Attempt, QuestionStats } from "@/types/progress";

interface PassFlowDB extends DBSchema {
  attempts: {
    key: number;
    value: Attempt;
    indexes: { questionId: string };
  };
  questionStats: {
    key: string;
    value: QuestionStats;
  };
  wrongNotes: {
    key: string;
    value: { questionId: string; addedAt: number };
  };
  favorites: {
    key: string;
    value: { questionId: string; addedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<PassFlowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PassFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PassFlowDB>("passflow", 1, {
      upgrade(db) {
        const attempts = db.createObjectStore("attempts", {
          keyPath: "id",
          autoIncrement: true,
        });
        attempts.createIndex("questionId", "questionId");
        db.createObjectStore("questionStats", { keyPath: "questionId" });
        db.createObjectStore("wrongNotes", { keyPath: "questionId" });
        db.createObjectStore("favorites", { keyPath: "questionId" });
      },
    });
  }
  return dbPromise;
}
