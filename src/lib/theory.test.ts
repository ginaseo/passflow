import { describe, expect, it } from "vitest";
import { isTheoryNameTruncated, resolveTheoryLink, SUBJECT_START_PAGES } from "./theory";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

describe("isTheoryNameTruncated", () => {
  it("'('로 시작하면 잘린 것으로 본다", () => {
    expect(isTheoryNameTruncated("(Waterfall Model)")).toBe(true);
  });

  it("여는 괄호 없이 ')'로 끝나면 잘린 것으로 본다", () => {
    expect(isTheoryNameTruncated("점진적 모형)")).toBe(true);
  });

  it("괄호가 정상적으로 짝지어지면 잘린 것이 아니다", () => {
    expect(isTheoryNameTruncated("핵심 소프트웨어 공학")).toBe(false);
    expect(isTheoryNameTruncated("스택(Stack)")).toBe(false);
  });
});

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    questionId: "test-Q1",
    examId: "test",
    qnum: 1,
    stem: "문항",
    options: ["a", "b", "c", "d"],
    subject: 2,
    answer: 1,
    explanation: "",
    image: null,
    ...overrides,
  };
}

const theoryMap: TheoryMap = {
  "075": { tag: "25.8", name: "스택(Stack)", page: 25, subject: "2과목 소프트웨어 개발" },
  "003": { tag: "24.7", name: "(Waterfall Model)", page: 4, subject: "1과목 소프트웨어 설계" },
};

describe("resolveTheoryLink", () => {
  it("sinagong이 있고 이름이 정상이면 이론명 + 정밀 페이지", () => {
    const q = makeQuestion({ subject: 2, sinagong: "075" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({ label: "스택(Stack)", page: 25 });
  });

  it("sinagong은 있지만 이름이 손상되면 과목명 + 정밀 페이지(과목 시작페이지 아님)", () => {
    const q = makeQuestion({ subject: 1, sinagong: "003" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({ label: "1과목 소프트웨어 설계", page: 4 });
  });

  it("sinagong이 theory_map에 없으면 과목 시작페이지로 폴백", () => {
    const q = makeQuestion({ subject: 3, sinagong: "999" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({
      label: "3과목 데이터베이스 구축",
      page: SUBJECT_START_PAGES[3],
    });
  });

  it("sinagong이 없으면 과목 시작페이지로 폴백", () => {
    const q = makeQuestion({ subject: 5 });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({
      label: "5과목 정보시스템 구축 관리",
      page: SUBJECT_START_PAGES[5],
    });
  });
});
