import { describe, expect, it } from "vitest";
import { pickLatestCompletedExamId, scoreExamFromAttempts } from "./latestExamResult";
import type { Attempt } from "@/types/progress";
import type { ExamSummary, Question } from "@/types/question";

const exams: ExamSummary[] = [
  { examId: "2024-1", title: "2024년 1회", count: 2 },
  { examId: "2024-2", title: "2024년 2회", count: 2 },
];

function attempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  return {
    solvedAt: 0,
    mode: "exam",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    ...overrides,
  };
}

function question(qnum: number, subject: number): Question {
  return {
    questionId: `2024-1-Q${qnum}`,
    examId: "2024-1",
    qnum,
    stem: "stem",
    options: ["a", "b"],
    subject,
    answer: 1,
    explanation: "",
    image: null,
  };
}

describe("pickLatestCompletedExamId", () => {
  it("완료된 회차가 없으면 null", () => {
    expect(pickLatestCompletedExamId(exams, [])).toBeNull();
  });

  it("완료된 회차 중 가장 최근 것을 고른다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000 }),
      attempt({ questionId: "2024-1-Q2", solvedAt: 1100 }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 2000 }),
      attempt({ questionId: "2024-2-Q2", solvedAt: 2100 }),
    ];
    expect(pickLatestCompletedExamId(exams, attempts)).toBe("2024-2");
  });

  it("일부만 푼(진행중) 회차는 후보에서 제외한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000 }),
      attempt({ questionId: "2024-1-Q2", solvedAt: 1100 }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 9999 }), // 2024-2는 1문항만 풀어서 진행중
    ];
    expect(pickLatestCompletedExamId(exams, attempts)).toBe("2024-1");
  });
});

describe("scoreExamFromAttempts", () => {
  const questions = [question(1, 1), question(2, 1)];

  it("exam모드 attempt가 하나도 없으면 null", () => {
    expect(scoreExamFromAttempts(questions, [], "2024-1")).toBeNull();
  });

  it("study모드 attempt만 있으면 null(CBT 성적에 안 씀)", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", mode: "study", isCorrect: true }),
      attempt({ questionId: "2024-1-Q2", mode: "study", isCorrect: true }),
    ];
    expect(scoreExamFromAttempts(questions, attempts, "2024-1")).toBeNull();
  });

  it("exam모드 정답/오답을 채점하고 합격여부를 판정한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: false, solvedAt: 200 }),
    ];
    const result = scoreExamFromAttempts(questions, attempts, "2024-1");
    expect(result).toEqual({ correct: 1, total: 2, passed: false });
  });

  it("같은 문항을 여러 번 풀었으면 가장 최근 것으로 채점한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: false, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 200 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
    ];
    const result = scoreExamFromAttempts(questions, attempts, "2024-1");
    expect(result).toEqual({ correct: 2, total: 2, passed: true });
  });

  it("다른 회차가 같은 qnum을 써도 섞이지 않는다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-2-Q1", isCorrect: false, solvedAt: 999 }), // 다른 회차의 같은 qnum
    ];
    const result = scoreExamFromAttempts(questions, attempts, "2024-1");
    expect(result).toEqual({ correct: 2, total: 2, passed: true });
  });

  it("exam모드로 안 푼 문항(이어서풀기로 study모드만 채운 경우)은 오답으로 처리되고 분모에 포함된다", () => {
    const fiveQuestions = [question(1, 1), question(2, 1), question(3, 1), question(4, 1), question(5, 1)];
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
      // Q3~Q5: exam모드 attempt 없음 — study모드로만 이어서 풀었다고 가정, 여기선 attempt 자체를 안 만듦
    ];
    const result = scoreExamFromAttempts(fiveQuestions, attempts, "2024-1");
    expect(result).toEqual({ correct: 2, total: 5, passed: false });
  });
});
