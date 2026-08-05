import { computeExamStatuses, pickMostRecentlyTouchedExam } from "./examStatus";
import { parseQuestionId } from "./questionId";
import { isPassed, type SubjectScore } from "./summary";
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

  if (latestByQnum.size === 0) return null;

  const bySubject = new Map<number, SubjectScore>();
  let correct = 0;
  const total = questions.length;

  for (const q of questions) {
    const subjectScore = bySubject.get(q.subject) ?? { subject: q.subject, total: 0, correct: 0 };
    subjectScore.total++;
    const a = latestByQnum.get(q.qnum);
    if (a?.isCorrect) {
      subjectScore.correct++;
      correct++;
    }
    bySubject.set(q.subject, subjectScore);
  }

  const passed = isPassed([...bySubject.values()]);

  return { correct, total, passed };
}
