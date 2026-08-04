import { describe, expect, it } from "vitest";
import { isPassed, isSubjectFailed, summarizeBySubject, summarizeSession } from "./summary";
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
      questions,
      answers: {},
    });
  });

  it("일부만 풀었을 때 solved는 푼 개수만, total은 전체 문항수", () => {
    const questions = [
      makeQuestion({ answer: 1 }),
      makeQuestion({ answer: 2 }),
      makeQuestion({ answer: 3 }),
    ];
    const answers = { 0: 1, 1: 3 };
    expect(summarizeSession(questions, answers)).toEqual({
      total: 3,
      solved: 2,
      correct: 1,
      wrong: 1,
      questions,
      answers,
    });
  });

  it("복수정답 문항도 정답 판정에 정확히 반영된다", () => {
    const questions = [makeQuestion({ answer: [3, 4] })];
    const answers = { 0: 4 };
    expect(summarizeSession(questions, answers)).toEqual({
      total: 1,
      solved: 1,
      correct: 1,
      wrong: 0,
      questions,
      answers,
    });
  });
});

describe("summarizeBySubject", () => {
  it("과목별로 문항수/정답수를 나눠 집계한다", () => {
    const questions = [
      makeQuestion({ subject: 1, answer: 1 }),
      makeQuestion({ subject: 1, answer: 2 }),
      makeQuestion({ subject: 2, answer: 1 }),
    ];
    const answers = { 0: 1, 1: 1, 2: 1 }; // 0번 정답, 1번 오답, 2번 정답
    expect(summarizeBySubject(questions, answers)).toEqual([
      { subject: 1, total: 2, correct: 1 },
      { subject: 2, total: 1, correct: 1 },
    ]);
  });

  it("답을 안 한 문항은 오답으로 집계된다(오답으로 셈)", () => {
    const questions = [makeQuestion({ subject: 1, answer: 1 })];
    expect(summarizeBySubject(questions, {})).toEqual([{ subject: 1, total: 1, correct: 0 }]);
  });

  it("subject 오름차순으로 정렬해서 반환한다", () => {
    const questions = [
      makeQuestion({ subject: 3, answer: 1 }),
      makeQuestion({ subject: 1, answer: 1 }),
    ];
    const result = summarizeBySubject(questions, { 0: 1, 1: 1 });
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
      { subject: 2, total: 20, correct: 5 }, // 25% 과락
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
