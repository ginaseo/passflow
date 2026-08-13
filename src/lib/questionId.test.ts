import { describe, expect, it } from "vitest";
import { makeQuestionId, parseQuestionId, tryParseQuestionId } from "./questionId";

describe("makeQuestionId", () => {
  it("jcg는 접두사 없이 examId·qnum만 결합한다(기존 데이터와의 호환성)", () => {
    expect(makeQuestionId("jcg", "2023-1", 13)).toBe("2023-1-Q13");
  });

  it("jcg 외 자격증은 certId 접두사를 붙인다", () => {
    expect(makeQuestionId("sqld", "SQLD-1", 36)).toBe("sqld:SQLD-1-Q36");
  });
});

describe("parseQuestionId", () => {
  it("certId가 박힌 questionId를 분리한다", () => {
    expect(parseQuestionId("jcg:2023-1-Q13")).toEqual({ certId: "jcg", examId: "2023-1", qnum: 13 });
  });

  it("다른 자격증 questionId도 분리한다", () => {
    expect(parseQuestionId("sqld:SQLD-1-Q36")).toEqual({ certId: "sqld", examId: "SQLD-1", qnum: 36 });
  });

  it("certId 접두사가 없는 구버전 questionId는 jcg로 취급한다", () => {
    expect(parseQuestionId("2023-1-Q13")).toEqual({ certId: "jcg", examId: "2023-1", qnum: 13 });
  });

  it("하이픈이 포함된 examId도 분리한다 (2020년 1·2회 통합)", () => {
    expect(parseQuestionId("jcg:2020-1-2-Q45")).toEqual({ certId: "jcg", examId: "2020-1-2", qnum: 45 });
  });

  it("-Q 마커가 없으면 명확한 에러를 던진다", () => {
    expect(() => parseQuestionId("malformed-id")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("qnum이 숫자가 아니면 에러를 던진다", () => {
    expect(() => parseQuestionId("jcg:2025-Qabc")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("qnum이 비어있으면 에러를 던진다", () => {
    expect(() => parseQuestionId("jcg:2025-Q")).toThrow(/잘못된 questionId 형식이다/);
  });

  it("examId가 비어있으면 에러를 던진다", () => {
    expect(() => parseQuestionId("-Q1")).toThrow(/잘못된 questionId 형식이다/);
    expect(() => parseQuestionId("jcg:-Q1")).toThrow(/잘못된 questionId 형식이다/);
  });
});

describe("tryParseQuestionId", () => {
  it("정상 questionId는 parseQuestionId와 동일하게 반환한다", () => {
    expect(tryParseQuestionId("jcg:2023-1-Q13")).toEqual({ certId: "jcg", examId: "2023-1", qnum: 13 });
  });

  it("손상된 questionId는 throw 대신 null을 반환한다", () => {
    expect(tryParseQuestionId("jcg:2025-Qabc")).toBeNull();
    expect(tryParseQuestionId("malformed-id")).toBeNull();
  });
});
