import { describe, expect, it } from "vitest";
import { getExamSessionWrongQuestionIds } from "./latestExamResult";
import type { Attempt } from "@/types/progress";
import type { Question } from "@/types/question";

function attempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  return {
    solvedAt: 0,
    mode: "exam",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: 0,
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

describe("getExamSessionWrongQuestionIds", () => {
  it("정답이 아니거나 아예 풀지 않은 문항을 모두 오답으로 돌려준다", () => {
    const questions = [question(1, 1), question(2, 1), question(3, 1)];
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: false, solvedAt: 200 }),
    ];

    expect(getExamSessionWrongQuestionIds(questions, attempts, "2024-1", "session-1")).toEqual([
      "2024-1-Q2",
      "2024-1-Q3",
    ]);
  });
});
