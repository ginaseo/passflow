import { gradeAnswer } from "./grading";
import type { Question } from "@/types/question";

export interface SessionSummary {
  total: number;
  solved: number;
  correct: number;
  wrong: number;
}

export function summarizeSession(
  questions: Question[],
  answers: Record<number, number>
): SessionSummary {
  const solvedIndices = Object.keys(answers).map(Number);
  const correct = solvedIndices.filter((i) => gradeAnswer(questions[i], answers[i])).length;

  return {
    total: questions.length,
    solved: solvedIndices.length,
    correct,
    wrong: solvedIndices.length - correct,
  };
}
