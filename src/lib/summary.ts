import { gradeAnswer } from "./grading";
import type { Question } from "@/types/question";

export interface SessionSummary {
  total: number;
  solved: number;
  correct: number;
  wrong: number;
  questions: Question[];
  answers: Record<number, number>;
}

export function summarizeSession(
  questions: Question[],
  answers: Record<number, number>
): SessionSummary {
  const solvedIndices = Object.keys(answers).map(Number);
  const correct = solvedIndices.filter((i) => gradeAnswer(questions[i], answers[i])).length;

  return {
    total: questions.length,
    solved: solvedIndices.length,
    correct,
    wrong: solvedIndices.length - correct,
    questions,
    answers,
  };
}

export interface SubjectScore {
  subject: number;
  total: number;
  correct: number;
}

export function summarizeBySubject(
  questions: Question[],
  answers: Record<number, number>
): SubjectScore[] {
  const bySubject = new Map<number, SubjectScore>();

  questions.forEach((question, i) => {
    const score = bySubject.get(question.subject) ?? {
      subject: question.subject,
      total: 0,
      correct: 0,
    };
    score.total += 1;
    if (i in answers && gradeAnswer(question, answers[i])) {
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
