import { computeExamStatuses, pickMostRecentlyTouchedExam } from "./examStatus";
import { parseQuestionId } from "./questionId";
import type { Attempt, EntryType, Mode } from "@/types/progress";
import type { ExamSummary, Question } from "@/types/question";

export function pickResumeExamId(exams: ExamSummary[], attempts: Attempt[]): string | null {
  const statuses = computeExamStatuses(exams, attempts);
  const inProgressExamIds = exams
    .filter((exam) => statuses.get(exam.examId) === "진행중")
    .map((exam) => exam.examId);
  return pickMostRecentlyTouchedExam(inProgressExamIds, attempts);
}

export function getUnansweredQuestions(
  questions: Question[],
  attempts: Attempt[],
  examId: string
): Question[] {
  const answeredQnums = new Set(
    attempts
      .filter((a) => parseQuestionId(a.questionId).examId === examId)
      .map((a) => parseQuestionId(a.questionId).qnum)
  );
  return questions.filter((q) => !answeredQnums.has(q.qnum));
}

export interface ResumeSession {
  sessionId: string;
  mode: Mode;
  entryType: EntryType;
  timeLimitMs: number | null;
  startedAt: number;
  answersByQnum: Record<number, number>;
}

export function pickResumeSession(attempts: Attempt[], examId: string): ResumeSession | null {
  const relevant = attempts.filter((a) => parseQuestionId(a.questionId).examId === examId);
  if (relevant.length === 0) return null;

  let latest = relevant[0];
  for (const a of relevant) {
    if (a.solvedAt > latest.solvedAt) latest = a;
  }
  const sessionAttempts = relevant.filter((a) => a.sessionId === latest.sessionId);

  let startedAt = sessionAttempts[0].solvedAt;
  const byQnum = new Map<number, Attempt>();
  for (const a of sessionAttempts) {
    if (a.solvedAt < startedAt) startedAt = a.solvedAt;
    const { qnum } = parseQuestionId(a.questionId);
    const prev = byQnum.get(qnum);
    if (!prev || a.solvedAt > prev.solvedAt) byQnum.set(qnum, a);
  }

  const answersByQnum: Record<number, number> = {};
  for (const [qnum, a] of byQnum) answersByQnum[qnum] = a.selectedAnswer;

  return {
    sessionId: latest.sessionId,
    mode: latest.mode,
    entryType: latest.entryType ?? "round",
    timeLimitMs: latest.timeLimitMs ?? null,
    startedAt,
    answersByQnum,
  };
}
