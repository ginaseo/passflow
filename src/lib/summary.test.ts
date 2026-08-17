import { describe, expect, it } from "vitest";
import { isPassed, isSubjectFailed, summarizeBySubject, summarizeSession } from "./summary";
import type { PublicQuestion } from "@/types/question";

function makeQuestion(overrides: Partial<PublicQuestion>): PublicQuestion {
  return {
    questionId: "test-Q1",
    examId: "test",
    qnum: 1,
    stem: "문항",
    options: ["a", "b", "c", "d"],
    subject: 1,
    image: null,
    ...overrides,
  };
}

describe("summarizeSession", () => {
  it("아무것도 안 풀었으면 solved/correct/wrong 전부 0", () => {
    const questions = [makeQuestion({}), makeQuestion({ qnum: 2 })];
    expect(summarizeSession(questions, {})).toEqual({
      total: 2,
      solved: 0,
      correct: 0,
      wrong: 0,
      questions,
      answers: {},
      correctByIndex: undefined,
    });
  });

  it("일부만 풀었을 때 solved는 푼 개수만, total은 전체 문항수", () => {
    const questions = [makeQuestion({}), makeQuestion({ qnum: 2 }), makeQuestion({ qnum: 3 })];
    const answers = { 0: 1, 1: 3 };
    const correctByIndex = { 0: true, 1: false };
    expect(summarizeSession(questions, answers, correctByIndex)).toEqual({
      total: 3,
      solved: 2,
      correct: 1,
      wrong: 1,
      questions,
      answers,
      correctByIndex,
    });
  });

  it("correctByIndex로 정답 판정을 반영한다", () => {
    const questions = [makeQuestion({})];
    const answers = { 0: 4 };
    const correctByIndex = { 0: true };
    expect(summarizeSession(questions, answers, correctByIndex)).toEqual({
      total: 1,
      solved: 1,
      correct: 1,
      wrong: 0,
      questions,
      answers,
      correctByIndex,
    });
  });
});

describe("summarizeBySubject", () => {
  it("과목별로 문항수/정답수를 나눠 집계한다", () => {
    const questions = [
      makeQuestion({ subject: 1 }),
      makeQuestion({ subject: 1, qnum: 2 }),
      makeQuestion({ subject: 2, qnum: 3 }),
    ];
    const answers = { 0: 1, 1: 1, 2: 1 };
    const correctByIndex = { 0: true, 1: false, 2: true };
    expect(summarizeBySubject(questions, answers, correctByIndex)).toEqual([
      { subject: 1, total: 2, correct: 1 },
      { subject: 2, total: 1, correct: 1 },
    ]);
  });

  it("답을 안 한 문항은 오답으로 집계된다(오답으로 셈)", () => {
    const questions = [makeQuestion({ subject: 1 })];
    expect(summarizeBySubject(questions, {})).toEqual([{ subject: 1, total: 1, correct: 0 }]);
  });

  it("subject 오름차순으로 정렬해서 반환한다", () => {
    const questions = [makeQuestion({ subject: 3 }), makeQuestion({ subject: 1, qnum: 2 })];
    const result = summarizeBySubject(questions, { 0: 1, 1: 1 }, { 0: true, 1: true });
    expect(result.map((s) => s.subject)).toEqual([1, 3]);
  });
});

describe("isSubjectFailed", () => {
  it("정답률 40% 미만이면 과락", () => {
    expect(isSubjectFailed({ subject: 1, total: 20, correct: 7 })).toBe(true);
  });

  it("정답률 40% 이상이면 과락 아님", () => {
    expect(isSubjectFailed({ subject: 1, total: 20, correct: 8 })).toBe(false);
  });
});

describe("isPassed", () => {
  it("전체 60% 이상 + 과락 없음이면 합격", () => {
    const scores = [
      { subject: 1, total: 20, correct: 15 },
      { subject: 2, total: 20, correct: 15 },
    ];
    expect(isPassed(scores)).toBe(true);
  });

  it("전체 60% 이상이어도 한 과목이라도 과락이면 불합격", () => {
    const scores = [
      { subject: 1, total: 20, correct: 20 },
      { subject: 2, total: 20, correct: 5 },
    ];
    expect(isPassed(scores)).toBe(false);
  });

  it("과락은 없어도 전체 60% 미만이면 불합격", () => {
    const scores = [
      { subject: 1, total: 20, correct: 9 },
      { subject: 2, total: 20, correct: 9 },
    ];
    expect(isPassed(scores)).toBe(false);
  });
});
