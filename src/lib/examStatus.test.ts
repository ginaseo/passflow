import { describe, expect, it } from "vitest";
import { computeExamStatuses } from "./examStatus";
import type { Attempt } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

const exams: ExamSummary[] = [
  { examId: "2024-1", title: "2024년 1회", count: 3 },
  { examId: "2024-2", title: "2024년 2회", count: 3 },
];

function attempt(questionId: string): Attempt {
  return {
    questionId,
    solvedAt: 0,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
  };
}

describe("computeExamStatuses", () => {
  it("풀이 기록이 없으면 미응시", () => {
    const result = computeExamStatuses(exams, []);
    expect(result.get("2024-1")).toBe("미응시");
    expect(result.get("2024-2")).toBe("미응시");
  });

  it("일부만 풀었으면 진행중", () => {
    const attempts = [attempt("2024-1-Q1"), attempt("2024-1-Q2")];
    const result = computeExamStatuses(exams, attempts);
    expect(result.get("2024-1")).toBe("진행중");
  });

  it("전체 문항수만큼 풀었으면 완료", () => {
    const attempts = [attempt("2024-1-Q1"), attempt("2024-1-Q2"), attempt("2024-1-Q3")];
    const result = computeExamStatuses(exams, attempts);
    expect(result.get("2024-1")).toBe("완료");
  });

  it("같은 문항을 여러 번 풀어도 중복 집계하지 않는다", () => {
    const attempts = [attempt("2024-1-Q1"), attempt("2024-1-Q1"), attempt("2024-1-Q1")];
    const result = computeExamStatuses(exams, attempts);
    expect(result.get("2024-1")).toBe("진행중");
  });
});
