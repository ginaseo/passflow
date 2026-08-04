import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Attempt, Favorite, QuestionStats, WrongNote } from "@/types/progress";
import type { Settings } from "@/types/settings";

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
    value: WrongNote;
  };
  favorites: {
    key: string;
    value: Favorite;
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<PassFlowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PassFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PassFlowDB>("passflow", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const attempts = db.createObjectStore("attempts", {
            keyPath: "id",
            autoIncrement: true,
          });
          attempts.createIndex("questionId", "questionId");
          db.createObjectStore("questionStats", { keyPath: "questionId" });
          db.createObjectStore("wrongNotes", { keyPath: "questionId" });
          db.createObjectStore("favorites", { keyPath: "questionId" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("settings");
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export function invalidateDb(): void {
  dbPromise = null;
}
