import type { Attempt } from "@/types/progress";

export function getRecentlySolvedQuestionIds(attempts: Attempt[], limit: number): string[] {
  const latestByQuestion = new Map<string, number>();
  for (const attempt of attempts) {
    const prev = latestByQuestion.get(attempt.questionId);
    if (prev === undefined || attempt.solvedAt > prev) {
      latestByQuestion.set(attempt.questionId, attempt.solvedAt);
    }
  }

  return [...latestByQuestion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([questionId]) => questionId);
}
