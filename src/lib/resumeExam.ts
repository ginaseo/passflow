import { computeExamStatuses, pickMostRecentlyTouchedExam } from "./examStatus";
import { parseQuestionId } from "./questionId";
import type { Attempt } from "@/types/progress";
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
