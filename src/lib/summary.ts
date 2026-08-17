import type { PublicQuestion, SubmitResult } from "@/types/question";

export interface SessionSummary {
  total: number;
  solved: number;
  correct: number;
  wrong: number;
  questions: PublicQuestion[];
  answers: Record<number, number>;
  correctByIndex?: Record<number, boolean>;
}

export function summarizeSession(
  questions: PublicQuestion[],
  answers: Record<number, number>,
  correctByIndex?: Record<number, boolean>
): SessionSummary {
  const solvedIndices = Object.keys(answers).map(Number);
  const correct = correctByIndex
    ? solvedIndices.filter((i) => correctByIndex[i]).length
    : 0;

  return {
    total: questions.length,
    solved: solvedIndices.length,
    correct,
    wrong: solvedIndices.length - correct,
    questions,
    answers,
    correctByIndex,
  };
}

export function summarizeFromSubmitResult(
  questions: PublicQuestion[],
  answers: Record<number, number>,
  submit: SubmitResult
): SessionSummary {
  const correctByIndex: Record<number, boolean> = {};
  for (const result of submit.results) {
    const index = questions.findIndex((q) => q.questionId === result.questionId);
    if (index >= 0) correctByIndex[index] = result.correct;
  }
  return {
    total: questions.length,
    solved: submit.solved,
    correct: submit.correct,
    wrong: submit.wrong,
    questions,
    answers,
    correctByIndex,
  };
}

export interface SubjectScore {
  subject: number;
  subjectName?: string;
  total: number;
  correct: number;
}

export function summarizeBySubject(
  questions: PublicQuestion[],
  answers: Record<number, number>,
  correctByIndex?: Record<number, boolean>
): SubjectScore[] {
  const bySubject = new Map<number, SubjectScore>();

  questions.forEach((question, i) => {
    const score = bySubject.get(question.subject) ?? {
      subject: question.subject,
      subjectName: question.subjectName,
      total: 0,
      correct: 0,
    };
    score.total += 1;
    if (i in answers && correctByIndex?.[i]) {
      score.correct += 1;
    }
    bySubject.set(question.subject, score);
  });

  return [...bySubject.values()].sort((a, b) => a.subject - b.subject);
}

export function isSubjectFailed(score: SubjectScore): boolean {
  return score.total > 0 && score.correct / score.total < 0.4;
}

export function isPassed(scores: SubjectScore[]): boolean {
  if (scores.length === 0) return false;
  const totalCorrect = scores.reduce((sum, s) => sum + s.correct, 0);
  const totalCount = scores.reduce((sum, s) => sum + s.total, 0);
  const overallAccuracy = totalCount === 0 ? 0 : totalCorrect / totalCount;
  return overallAccuracy >= 0.6 && scores.every((s) => !isSubjectFailed(s));
}
