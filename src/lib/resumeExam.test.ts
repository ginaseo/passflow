import { describe, expect, it } from "vitest";
import { getUnansweredQuestions, pickResumeExamId } from "./resumeExam";
import type { Attempt } from "@/types/progress";
import type { ExamSummary, Question } from "@/types/question";

const exams: ExamSummary[] = [
  { examId: "2024-1", title: "2024년 1회", count: 2 },
  { examId: "2024-2", title: "2024년 2회", count: 2 },
];

function attempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  return {
    solvedAt: 0,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    ...overrides,
  };
}

function question(examId: string, qnum: number): Question {
  return {
    questionId: `${examId}-Q${qnum}`,
    examId,
    qnum,
    stem: "stem",
    options: ["a", "b"],
    subject: 1,
    answer: 1,
    explanation: "",
    image: null,
  };
}

describe("pickResumeExamId", () => {
  it("진행중인 회차가 없으면 null", () => {
    expect(pickResumeExamId(exams, [])).toBeNull();
  });

  it("완료된 회차는 재개 대상에서 제외한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1" }),
      attempt({ questionId: "2024-1-Q2" }),
    ];
    expect(pickResumeExamId(exams, attempts)).toBeNull();
  });

  it("진행중 회차 중 가장 최근에 손댄 것을 고른다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000 }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 5000 }),
    ];
    expect(pickResumeExamId(exams, attempts)).toBe("2024-2");
  });
});

describe("getUnansweredQuestions", () => {
  it("해당 회차에서 아직 안 푼 문항만 남긴다", () => {
    const questions = [question("2024-1", 1), question("2024-1", 2)];
    const attempts = [attempt({ questionId: "2024-1-Q1" })];
    const result = getUnansweredQuestions(questions, attempts, "2024-1");
    expect(result.map((q) => q.qnum)).toEqual([2]);
  });

  it("다른 회차의 attempt는 영향을 주지 않는다", () => {
    const questions = [question("2024-1", 1)];
    const attempts = [attempt({ questionId: "2024-2-Q1" })];
    const result = getUnansweredQuestions(questions, attempts, "2024-1");
    expect(result.map((q) => q.qnum)).toEqual([1]);
  });
});
