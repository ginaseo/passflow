import { describe, expect, it } from "vitest";
import { makeQuestionId, parseQuestionId } from "./questionId";

describe("makeQuestionId", () => {
  it("examId와 qnum을 결합한다", () => {
    expect(makeQuestionId("2023-1", 13)).toBe("2023-1-Q13");
  });
});

describe("parseQuestionId", () => {
  it("일반 examId를 분리한다", () => {
    expect(parseQuestionId("2023-1-Q13")).toEqual({ examId: "2023-1", qnum: 13 });
  });

  it("하이픈이 포함된 examId도 분리한다 (2020년 1·2회 통합)", () => {
    expect(parseQuestionId("2020-1-2-Q45")).toEqual({ examId: "2020-1-2", qnum: 45 });
  });
});
