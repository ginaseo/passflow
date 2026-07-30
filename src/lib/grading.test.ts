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

  it("answer가 배열(복수 정답)이면 포함된 옵션은 true, 아니면 false", () => {
    const multiAnswerQuestion: Question = { ...baseQuestion, answer: [3, 4] };
    expect(gradeAnswer(multiAnswerQuestion, 3)).toBe(true);
    expect(gradeAnswer(multiAnswerQuestion, 4)).toBe(true);
    expect(gradeAnswer(multiAnswerQuestion, 1)).toBe(false);
  });

  it("answer가 모든 옵션을 포함한 배열(전항정답)이면 모든 선택지가 true", () => {
    const allCorrectQuestion: Question = { ...baseQuestion, answer: [1, 2, 3, 4] };
    expect(gradeAnswer(allCorrectQuestion, 1)).toBe(true);
    expect(gradeAnswer(allCorrectQuestion, 2)).toBe(true);
    expect(gradeAnswer(allCorrectQuestion, 3)).toBe(true);
    expect(gradeAnswer(allCorrectQuestion, 4)).toBe(true);
  });
});
