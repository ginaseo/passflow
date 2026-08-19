import type { Question, SelectedAnswer } from "@/types/question";

export function isCorrectOption(question: Question, optionNumber: number): boolean {
  return Array.isArray(question.answer)
    ? question.answer.includes(optionNumber)
    : optionNumber === question.answer;
}

function toSortedSet(value: SelectedAnswer): number[] {
  return (Array.isArray(value) ? value : [value]).slice().sort((a, b) => a - b);
}

// 정답이 여러 개인 문항(question.answer가 배열)은 선택한 답 전체가 정답 집합과
// 정확히 일치할 때만 정답이다 — 개수가 다르거나 하나라도 안 겹치면 오답.
export function gradeAnswer(question: Question, selectedAnswer: SelectedAnswer): boolean {
  const correct = toSortedSet(question.answer);
  const selected = toSortedSet(selectedAnswer);
  return correct.length === selected.length && correct.every((v, i) => v === selected[i]);
}
