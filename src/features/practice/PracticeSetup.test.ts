import { describe, expect, it } from "vitest";
import { getOrderedVisibleExams } from "./PracticeSetup";
import type { ExamSummary } from "@/types/question";

function exam(examId: string, count = 1): ExamSummary {
  return { examId, title: examId, count };
}

describe("getOrderedVisibleExams", () => {
  it("jcg는 파일 순서(오래된 것부터)를 뒤집어 최신이 먼저 오게 한다", () => {
    const exams = [exam("2023-1"), exam("2023-2"), exam("2024-1")];
    const result = getOrderedVisibleExams(exams, "jcg");
    expect(result.map((e) => e.examId)).toEqual(["2024-1", "2023-2", "2023-1"]);
  });

  it("jcg는 원본 배열을 변경하지 않는다", () => {
    const exams = [exam("2023-1"), exam("2023-2")];
    getOrderedVisibleExams(exams, "jcg");
    expect(exams.map((e) => e.examId)).toEqual(["2023-1", "2023-2"]);
  });

  it("sqld는 기출복원 회차(SQLD-N)를 숫자 큰 순(최신 우선)으로 정렬한다", () => {
    const exams = [exam("SQLD-48"), exam("SQLD-50"), exam("SQLD-49")];
    const result = getOrderedVisibleExams(exams, "sqld");
    expect(result.map((e) => e.examId)).toEqual(["SQLD-50", "SQLD-49", "SQLD-48"]);
  });

  it("sqld는 노랭이(주제별 원본 문제집, SQLD-N-N)를 맨 아래로 보낸다", () => {
    const exams = [exam("SQLD-1-1"), exam("SQLD-49"), exam("SQLD-2-1"), exam("SQLD-48")];
    const result = getOrderedVisibleExams(exams, "sqld");
    expect(result.map((e) => e.examId)).toEqual(["SQLD-49", "SQLD-48", "SQLD-1-1", "SQLD-2-1"]);
  });

  it("sqld는 회차도 노랭이도 아닌 항목을 rest로 두어 회차 다음·노랭이 이전에 원래 상대 순서대로 배치한다", () => {
    const exams = [exam("SQLD-etc-b"), exam("SQLD-49"), exam("SQLD-1-1"), exam("SQLD-etc-a")];
    const result = getOrderedVisibleExams(exams, "sqld");
    expect(result.map((e) => e.examId)).toEqual(["SQLD-49", "SQLD-etc-b", "SQLD-etc-a", "SQLD-1-1"]);
  });

  it("sqld는 원본 배열을 변경하지 않는다", () => {
    const exams = [exam("SQLD-1-1"), exam("SQLD-50"), exam("SQLD-49")];
    getOrderedVisibleExams(exams, "sqld");
    expect(exams.map((e) => e.examId)).toEqual(["SQLD-1-1", "SQLD-50", "SQLD-49"]);
  });

  it("jcg·sqld가 아닌 자격증은 원래 목록을 그대로 반환한다", () => {
    const exams = [exam("2023-1"), exam("2023-2")];
    const result = getOrderedVisibleExams(exams, "unknown-cert");
    expect(result).toEqual(exams);
  });

  it("빈 목록이 주어져도 오류 없이 빈 배열을 반환한다", () => {
    expect(getOrderedVisibleExams([], "jcg")).toEqual([]);
    expect(getOrderedVisibleExams([], "sqld")).toEqual([]);
    expect(getOrderedVisibleExams([], "unknown")).toEqual([]);
  });

  it("sqld 목록이 노랭이만으로 이루어져 있으면 그대로 노랭이만 남는다", () => {
    const exams = [exam("SQLD-2-1"), exam("SQLD-1-1")];
    const result = getOrderedVisibleExams(exams, "sqld");
    expect(result.map((e) => e.examId)).toEqual(["SQLD-2-1", "SQLD-1-1"]);
  });
});