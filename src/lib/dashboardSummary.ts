import { isSameLocalDay } from "./timer";
import { tryParseQuestionId } from "./questionId";
import type { Attempt, DashboardSummary } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

// attempts는 전 자격증 통틀어 하나의 IndexedDB에 쌓인다 — questionId에 박힌 examId가
// 현재 선택된 자격증의 회차 목록에 속하는 것만 걸러낸다. 안 그러면 자격증을 바꿔도
// 다른 자격증 풀이 기록이 통계에 섞여 나온다.
export function scopeAttemptsToExams(attempts: Attempt[], exams: ExamSummary[]): Attempt[] {
  const examIds = new Set(exams.map((e) => e.examId));
  return attempts.filter((a) => {
    const examId = tryParseQuestionId(a.questionId)?.examId;
    return examId !== undefined && examIds.has(examId);
  });
}

export function computeDashboardSummary(attempts: Attempt[]): DashboardSummary {
  const now = Date.now();
  const today = attempts.filter((a) => isSameLocalDay(a.solvedAt, now));

  const accuracy = (list: Attempt[]) =>
    list.length === 0 ? 0 : list.filter((a) => a.isCorrect).length / list.length;

  return {
    todayCount: today.length,
    todayAccuracy: accuracy(today),
    totalCount: attempts.length,
    totalAccuracy: accuracy(attempts),
  };
}
