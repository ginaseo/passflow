import { parseQuestionId } from "./questionId";
import { isPassed, type SubjectScore } from "./summary";
import type { Attempt } from "@/types/progress";
import type { Question } from "@/types/question";

export function listExamSessions(
  attempts: Attempt[]
): { examId: string; sessionId: string; solvedAt: number }[] {
  // entryType은 이 필드가 생기기 전에 기록된 구버전 attempt에는 없을 수 있다 —
  // 그런 attempt는 round로 취급한다(이 앱에서 시험모드+랜덤이 실사용된 이력이 없다).
  const examAttempts = attempts.filter((a) => a.mode === "exam" && (a.entryType ?? "round") === "round");

  const bySession = new Map<string, { examId: string; solvedAt: number }>();
  for (const a of examAttempts) {
    const { examId } = parseQuestionId(a.questionId);
    const existing = bySession.get(a.sessionId);
    if (!existing || a.solvedAt > existing.solvedAt) {
      bySession.set(a.sessionId, { examId, solvedAt: a.solvedAt });
    }
  }

  return [...bySession.entries()]
    .map(([sessionId, { examId, solvedAt }]) => ({ examId, sessionId, solvedAt }))
    .sort((a, b) => b.solvedAt - a.solvedAt);
}

export function scoreExamSession(
  questions: Question[],
  attempts: Attempt[],
  examId: string,
  sessionId: string
): { correct: number; total: number; passed: boolean; subjectScores: SubjectScore[] } {
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

  const subjectScores = [...bySubject.values()].sort((a, b) => a.subject - b.subject);
  const passed = isPassed(subjectScores);

  return { correct, total, passed, subjectScores };
}
