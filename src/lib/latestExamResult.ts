import { computeExamStatuses, pickMostRecentlyTouchedExam } from "./examStatus";
import { parseQuestionId } from "./questionId";
import type { Attempt } from "@/types/progress";
import type { ExamSummary, Question } from "@/types/question";

export function pickLatestCompletedExamId(exams: ExamSummary[], attempts: Attempt[]): string | null {
  const statuses = computeExamStatuses(exams, attempts);
  const completedExamIds = exams
    .filter((exam) => statuses.get(exam.examId) === "완료")
    .map((exam) => exam.examId);
  return pickMostRecentlyTouchedExam(completedExamIds, attempts);
}

export function scoreExamFromAttempts(
  questions: Question[],
  attempts: Attempt[],
  examId: string
): { correct: number; total: number; passed: boolean } | null {
  const latestByQnum = new Map<number, Attempt>();
  for (const a of attempts) {
    if (a.mode !== "exam") continue;
    const { examId: attemptExamId, qnum } = parseQuestionId(a.questionId);
    if (attemptExamId !== examId) continue;
    const prev = latestByQnum.get(qnum);
    if (!prev || a.solvedAt > prev.solvedAt) latestByQnum.set(qnum, a);
  }

  const bySubject = new Map<number, { correct: number; total: number }>();
  let correct = 0;
  let total = 0;

  for (const q of questions) {
    const a = latestByQnum.get(q.qnum);
    if (!a) continue;
    total++;
    const subjectScore = bySubject.get(q.subject) ?? { correct: 0, total: 0 };
    subjectScore.total++;
    if (a.isCorrect) {
      subjectScore.correct++;
      correct++;
    }
    bySubject.set(q.subject, subjectScore);
  }

  if (total === 0) return null;

  const hasFailedSubject = [...bySubject.values()].some(
    (s) => s.total > 0 && s.correct / s.total < 0.4
  );
  const passed = !hasFailedSubject && correct / total >= 0.6;

  return { correct, total, passed };
}
