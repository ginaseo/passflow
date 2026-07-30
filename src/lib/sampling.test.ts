import { describe, expect, it } from "vitest";
import { pickRandomQuestions } from "./sampling";
import type { Question } from "@/types/question";

function makeQuestions(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    questionId: `test-Q${i}`,
    examId: "test",
    qnum: i,
    stem: `문항 ${i}`,
    options: ["a", "b", "c", "d"],
    subject: 1,
    answer: 1,
    explanation: "",
    image: null,
  }));
}

describe("pickRandomQuestions", () => {
  it("count만큼 중복 없이 뽑는다", () => {
    const pool = makeQuestions(10);
    const picked = pickRandomQuestions(pool, 4, () => 0.5);
    expect(picked).toHaveLength(4);
    const ids = new Set(picked.map((q) => q.questionId));
    expect(ids.size).toBe(4);
  });

  it("count가 풀 크기보다 크면 풀 전체를 반환한다", () => {
    const pool = makeQuestions(3);
    const picked = pickRandomQuestions(pool, 10, () => 0.5);
    expect(picked).toHaveLength(3);
  });

  it("같은 rng 시퀀스면 같은 결과를 낸다 (결정론적 셔플 검증)", () => {
    const pool = makeQuestions(5);
    const sequence = [0.9, 0.1, 0.5, 0.3];
    let call = 0;
    const rng = () => sequence[call++ % sequence.length];

    call = 0;
    const first = pickRandomQuestions(pool, 5, rng);
    call = 0;
    const second = pickRandomQuestions(pool, 5, rng);

    expect(first.map((q) => q.questionId)).toEqual(second.map((q) => q.questionId));
  });
});
