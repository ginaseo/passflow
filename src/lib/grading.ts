import type { Question } from "@/types/question";

export function gradeAnswer(question: Question, selectedAnswer: number): boolean {
  return selectedAnswer === question.answer;
}
