import { describe, expect, it } from "vitest";
import { computeExamStatuses, pickMostRecentlyTouchedExam } from "./examStatus";
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
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: 0,
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

describe("pickMostRecentlyTouchedExam", () => {
  it("후보 목록이 비어있으면 null", () => {
    expect(pickMostRecentlyTouchedExam([], [])).toBeNull();
  });

  it("각 회차의 attempt 중 가장 늦은 solvedAt을 가진 회차를 고른다", () => {
    const attempts = [
      { ...attempt("2024-1-Q1"), solvedAt: 1000 },
      { ...attempt("2024-2-Q1"), solvedAt: 5000 },
      { ...attempt("2024-2-Q2"), solvedAt: 3000 },
    ];
    expect(pickMostRecentlyTouchedExam(["2024-1", "2024-2"], attempts)).toBe("2024-2");
  });

  it("후보 examId에 해당하는 attempt가 하나도 없으면 null", () => {
    const attempts = [attempt("2024-1-Q1")];
    expect(pickMostRecentlyTouchedExam(["2024-9"], attempts)).toBeNull();
  });
});
