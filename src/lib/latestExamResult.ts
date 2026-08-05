import { parseQuestionId } from "./questionId";
import { isPassed, type SubjectScore } from "./summary";
import type { Attempt } from "@/types/progress";
import type { Question } from "@/types/question";

export function pickLatestExamSession(attempts: Attempt[]): { examId: string; sessionId: string } | null {
  // entryType은 이 필드가 생기기 전에 기록된 IndexedDB의 구버전 attempt에는 실제로
  // 없을 수 있다(TS 타입은 required지만 런타임 데이터는 그보다 오래됐을 수 있음) —
  // 그런 attempt는 "round"로 취급한다(이 앱에서 시험모드+랜덤 조합이 실사용된 이력이 없다).
  const examAttempts = attempts.filter((a) => a.mode === "exam" && (a.entryType ?? "round") === "round");
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
