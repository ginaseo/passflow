import type { Attempt } from "@/types/progress";

export function getAllSolvedQuestionIds(attempts: Attempt[]): string[] {
  const lastSolvedAt = new Map<string, number>();
  for (const a of attempts) {
    const prev = lastSolvedAt.get(a.questionId);
    if (prev === undefined || a.solvedAt > prev) {
      lastSolvedAt.set(a.questionId, a.solvedAt);
    }
  }
  return [...lastSolvedAt.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([questionId]) => questionId);
}
