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
});
