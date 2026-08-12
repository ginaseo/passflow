import { isSameLocalDay } from "./timer";
import type { Attempt, DashboardSummary } from "@/types/progress";

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
