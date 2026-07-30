import { describe, expect, it } from "vitest";
import { summarizeSession } from "./summary";
import type { Question } from "@/types/question";

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    questionId: "test-Q1",
    examId: "test",
    qnum: 1,
    stem: "문항",
    options: ["a", "b", "c", "d"],
    subject: 1,
    answer: 1,
    explanation: "",
    image: null,
    ...overrides,
  };
}

describe("summarizeSession", () => {
  it("아무것도 안 풀었으면 solved/correct/wrong 전부 0", () => {
    const questions = [makeQuestion({ answer: 1 }), makeQuestion({ answer: 2 })];
    expect(summarizeSession(questions, {})).toEqual({
      total: 2,
      solved: 0,
      correct: 0,
      wrong: 0,
    });
  });

  it("일부만 풀었을 때 solved는 푼 개수만, total은 전체 문항수", () => {
    const questions = [
      makeQuestion({ answer: 1 }),
      makeQuestion({ answer: 2 }),
      makeQuestion({ answer: 3 }),
    ];
    expect(summarizeSession(questions, { 0: 1, 1: 3 })).toEqual({
      total: 3,
      solved: 2,
      correct: 1,
      wrong: 1,
    });
  });

  it("복수정답 문항도 정답 판정에 정확히 반영된다", () => {
    const questions = [makeQuestion({ answer: [3, 4] })];
    expect(summarizeSession(questions, { 0: 4 })).toEqual({
      total: 1,
      solved: 1,
      correct: 1,
      wrong: 0,
    });
  });
});
