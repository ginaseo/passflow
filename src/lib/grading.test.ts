import { describe, expect, it } from "vitest";
import { gradeAnswer } from "./grading";
import type { Question } from "@/types/question";

const baseQuestion: Question = {
  questionId: "2023-1-Q1",
  examId: "2023-1",
  qnum: 1,
  stem: "테스트 문항",
  options: ["1번", "2번", "3번", "4번"],
  subject: 1,
  answer: 3,
  explanation: "설명",
  image: null,
};

describe("gradeAnswer", () => {
  it("선택한 답이 정답과 같으면 true", () => {
    expect(gradeAnswer(baseQuestion, 3)).toBe(true);
  });

  it("선택한 답이 정답과 다르면 false", () => {
    expect(gradeAnswer(baseQuestion, 1)).toBe(false);
  });

  it("answer가 배열(복수 정답)이면 정답 집합과 정확히 일치할 때만 true다", () => {
    const multiAnswerQuestion: Question = { ...baseQuestion, answer: [3, 4] };
    expect(gradeAnswer(multiAnswerQuestion, [3, 4])).toBe(true);
    expect(gradeAnswer(multiAnswerQuestion, [4, 3])).toBe(true); // 순서 무관
  });

  it("정답 개수인 2개 중 1개만 선택하면(부분 일치) false다", () => {
    const multiAnswerQuestion: Question = { ...baseQuestion, answer: [3, 4] };
    expect(gradeAnswer(multiAnswerQuestion, 3)).toBe(false);
    expect(gradeAnswer(multiAnswerQuestion, [3])).toBe(false);
  });

  it("정답 개수보다 많이 선택하거나 틀린 조합을 선택하면 false다", () => {
    const multiAnswerQuestion: Question = { ...baseQuestion, answer: [3, 4] };
    expect(gradeAnswer(multiAnswerQuestion, [3, 4, 1])).toBe(false);
    expect(gradeAnswer(multiAnswerQuestion, [1, 2])).toBe(false);
  });

  it("answer가 모든 옵션을 포함한 배열(전항정답)이면 전체를 골라야 true다", () => {
    const allCorrectQuestion: Question = { ...baseQuestion, answer: [1, 2, 3, 4] };
    expect(gradeAnswer(allCorrectQuestion, [1, 2, 3, 4])).toBe(true);
    expect(gradeAnswer(allCorrectQuestion, [1, 2, 3])).toBe(false);
  });
});
