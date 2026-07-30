export type Mode = "exam" | "study";

export interface Attempt {
  id?: number;
  questionId: string;
  solvedAt: number;
  mode: Mode;
  selectedAnswer: number;
  isCorrect: boolean;
  solveTimeMs: number;
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
