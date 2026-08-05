import { parseQuestionId } from "./questionId";
import type { Attempt } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

export type ExamStatus = "완료" | "진행중" | "미응시";

export function computeExamStatuses(
  exams: ExamSummary[],
  attempts: Attempt[]
): Map<string, ExamStatus> {
  const solvedByExam = new Map<string, Set<number>>();
  for (const attempt of attempts) {
    const { examId, qnum } = parseQuestionId(attempt.questionId);
    let set = solvedByExam.get(examId);
    if (!set) {
      set = new Set();
      solvedByExam.set(examId, set);
    }
    set.add(qnum);
  }

  const result = new Map<string, ExamStatus>();
  for (const exam of exams) {
    const solvedCount = solvedByExam.get(exam.examId)?.size ?? 0;
    if (solvedCount === 0) result.set(exam.examId, "미응시");
    else if (solvedCount >= exam.count) result.set(exam.examId, "완료");
    else result.set(exam.examId, "진행중");
  }
  return result;
}

export function pickMostRecentlyTouchedExam(examIds: string[], attempts: Attempt[]): string | null {
  let latestExamId: string | null = null;
  let latestSolvedAt = -Infinity;

  for (const examId of examIds) {
    const maxSolvedAt = attempts
      .filter((a) => parseQuestionId(a.questionId).examId === examId)
      .reduce((max, a) => Math.max(max, a.solvedAt), -Infinity);
    if (maxSolvedAt > latestSolvedAt) {
      latestSolvedAt = maxSolvedAt;
      latestExamId = examId;
    }
  }

  return latestExamId;
}
