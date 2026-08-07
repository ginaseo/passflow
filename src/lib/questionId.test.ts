import { describe, expect, it } from "vitest";
import { makeQuestionId, parseQuestionId, tryParseQuestionId } from "./questionId";

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

  it("-Q 마커가 없으면 명확한 에러를 던진다", () => {
    expect(() => parseQuestionId("malformed-id")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("qnum이 숫자가 아니면 에러를 던진다", () => {
    expect(() => parseQuestionId("2025-Qabc")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("qnum이 비어있으면 에러를 던진다", () => {
    expect(() => parseQuestionId("2025-Q")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("examId가 비어있으면 에러를 던진다", () => {
    expect(() => parseQuestionId("-Q1")).toThrow(/잘못된 questionId 형식이다/);
  });
});

describe("tryParseQuestionId", () => {
  it("정상 questionId는 parseQuestionId와 동일하게 반환한다", () => {
    expect(tryParseQuestionId("2023-1-Q13")).toEqual({ examId: "2023-1", qnum: 13 });
  });

  it("손상된 questionId는 throw 대신 null을 반환한다", () => {
    expect(tryParseQuestionId("2025-Qabc")).toBeNull();
    expect(tryParseQuestionId("malformed-id")).toBeNull();
  });
});
