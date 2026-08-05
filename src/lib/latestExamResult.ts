import { parseQuestionId } from "./questionId";
import { isPassed, type SubjectScore } from "./summary";
import type { Attempt } from "@/types/progress";
import type { Question } from "@/types/question";

export function pickLatestExamSession(attempts: Attempt[]): { examId: string; sessionId: string } | null {
  const examAttempts = attempts.filter((a) => a.mode === "exam");
  if (examAttempts.length === 0) return null;

  const latest = examAttempts.reduce((max, a) => (a.solvedAt > max.solvedAt ? a : max));
  const { examId } = parseQuestionId(latest.questionId);
  return { examId, sessionId: latest.sessionId };
}

export function scoreExamSession(
  questions: Question[],
  attempts: Attempt[],
  examId: string,
  sessionId: string
): { correct: number; total: number; passed: boolean } {
  const byQnum = new Map<number, Attempt>();
  for (const a of attempts) {
    if (a.mode !== "exam" || a.sessionId !== sessionId) continue;
    const { examId: attemptExamId, qnum } = parseQuestionId(a.questionId);
    if (attemptExamId !== examId) continue;
    const prev = byQnum.get(qnum);
    if (!prev || a.solvedAt > prev.solvedAt) byQnum.set(qnum, a);
  }

  const bySubject = new Map<number, SubjectScore>();
  let correct = 0;
  const total = questions.length;

  for (const q of questions) {
    const subjectScore = bySubject.get(q.subject) ?? { subject: q.subject, total: 0, correct: 0 };
    subjectScore.total++;
    const a = byQnum.get(q.qnum);
    if (a?.isCorrect) {
      subjectScore.correct++;
      correct++;
    }
    bySubject.set(q.subject, subjectScore);
  }

  const passed = isPassed([...bySubject.values()]);
  return { correct, total, passed };
}
