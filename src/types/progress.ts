export type Mode = "exam" | "study";
export type EntryType = "round" | "random";

export interface Attempt {
  id?: number;
  questionId: string;
  solvedAt: number;
  mode: Mode;
  entryType: EntryType;
  selectedAnswer: number;
  isCorrect: boolean;
  solveTimeMs: number;
  sessionId: string;
  timeLimitMs: number | null;
  sessionStartedAt: number;
}

export interface QuestionStats {
  questionId: string;
  correctCount: number;
  wrongCount: number;
  lastSolvedAt: number;
}

export interface DashboardSummary {
  todayCount: number;
  todayAccuracy: number;
  totalCount: number;
  totalAccuracy: number;
}

export interface WrongNote {
  questionId: string;
  addedAt: number;
  mode: Mode;
}

export interface Favorite {
  questionId: string;
  addedAt: number;
}
