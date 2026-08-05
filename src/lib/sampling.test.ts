import { describe, expect, it } from "vitest";
import { pickRandomQuestions, pickStratifiedRandomQuestions } from "./sampling";
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

function makeQuestionsBySubject(countsBySubject: Record<number, number>): Question[] {
  const result: Question[] = [];
  let qnum = 0;
  for (const [subjectStr, count] of Object.entries(countsBySubject)) {
    const subject = Number(subjectStr);
    for (let i = 0; i < count; i++) {
      result.push({
        questionId: `test-Q${qnum}`,
        examId: "test",
        qnum: qnum++,
        stem: `문항 ${qnum}`,
        options: ["a", "b", "c", "d"],
        subject,
        answer: 1,
        explanation: "",
        image: null,
      });
    }
  }
  return result;
}

describe("pickStratifiedRandomQuestions", () => {
  it("문항수가 과목수로 나누어떨어지면 과목별로 동일하게 배분한다", () => {
    const pool = makeQuestionsBySubject({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 });
    const picked = pickStratifiedRandomQuestions(pool, 20, () => 0.5);
    expect(picked).toHaveLength(20);
    const bySubject = new Map<number, number>();
    for (const q of picked) bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1);
    expect([...bySubject.values()]).toEqual([4, 4, 4, 4, 4]);
  });

  it("문항수 100이면 과목당 20개씩 뽑는다", () => {
    const pool = makeQuestionsBySubject({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
    const picked = pickStratifiedRandomQuestions(pool, 100, () => 0.5);
    expect(picked).toHaveLength(100);
    const bySubject = new Map<number, number>();
    for (const q of picked) bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1);
    expect([...bySubject.values()]).toEqual([20, 20, 20, 20, 20]);
  });

  it("나누어떨어지지 않으면 과목번호 오름차순으로 나머지를 배분한다", () => {
    const pool = makeQuestionsBySubject({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 });
    const picked = pickStratifiedRandomQuestions(pool, 22, () => 0.5);
    expect(picked).toHaveLength(22);
    const bySubject = new Map<number, number>();
    for (const q of picked) bySubject.set(q.subject, (bySubject.get(q.subject) ?? 0) + 1);
    expect(bySubject.get(1)).toBe(5);
    expect(bySubject.get(2)).toBe(5);
    expect(bySubject.get(3)).toBe(4);
    expect(bySubject.get(4)).toBe(4);
    expect(bySubject.get(5)).toBe(4);
  });

  it("과목이 하나도 없으면 빈 배열을 반환한다", () => {
    expect(pickStratifiedRandomQuestions([], 20, () => 0.5)).toEqual([]);
  });

  it("중복 없이 뽑는다", () => {
    const pool = makeQuestionsBySubject({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 });
    const picked = pickStratifiedRandomQuestions(pool, 20, () => 0.5);
    const ids = new Set(picked.map((q) => q.questionId));
    expect(ids.size).toBe(20);
  });
});
