import type { Question } from "@/types/question";

export function isCorrectOption(question: Question, optionNumber: number): boolean {
  return Array.isArray(question.answer)
    ? question.answer.includes(optionNumber)
    : optionNumber === question.answer;
}

export function gradeAnswer(question: Question, selectedAnswer: number): boolean {
  return isCorrectOption(question, selectedAnswer);
}
