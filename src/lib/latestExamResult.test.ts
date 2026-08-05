import { describe, expect, it } from "vitest";
import { pickLatestExamSession, scoreExamSession } from "./latestExamResult";
import type { Attempt } from "@/types/progress";
import type { Question } from "@/types/question";

function attempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  return {
    solvedAt: 0,
    mode: "exam",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    ...overrides,
  };
}

function question(qnum: number, subject: number): Question {
  return {
    questionId: `2024-1-Q${qnum}`,
    examId: "2024-1",
    qnum,
    stem: "stem",
    options: ["a", "b"],
    subject,
    answer: 1,
    explanation: "",
    image: null,
  };
}

describe("pickLatestExamSession", () => {
  it("exam모드 attempt가 하나도 없으면 null", () => {
    expect(pickLatestExamSession([])).toBeNull();
  });

  it("study모드 attempt만 있으면 null", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", mode: "study", solvedAt: 1000 }),
      attempt({ questionId: "2024-1-Q2", mode: "study", solvedAt: 1100 }),
    ];
    expect(pickLatestExamSession(attempts)).toBeNull();
  });

  it("가장 최근 exam모드 attempt의 회차/세션을 고른다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000, sessionId: "session-a" }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 2000, sessionId: "session-b" }),
    ];
    expect(pickLatestExamSession(attempts)).toEqual({ examId: "2024-2", sessionId: "session-b" });
  });

  it("더 최근에 study모드로만 완료된 회차가 있어도 exam모드 attempt가 있는(더 오래된) 진짜 CBT 세션을 고른다", () => {
    const attempts = [
      // 오래된 진짜 CBT 세션 (exam모드)
      attempt({ questionId: "2024-1-Q1", mode: "exam", solvedAt: 1000, sessionId: "session-a", isCorrect: true }),
      attempt({ questionId: "2024-1-Q2", mode: "exam", solvedAt: 1100, sessionId: "session-a", isCorrect: true }),
      // 더 최근이지만 study모드로만 완료(exam모드 attempt 없음)
      attempt({ questionId: "2024-2-Q1", mode: "study", solvedAt: 5000, sessionId: "session-b", isCorrect: true }),
      attempt({ questionId: "2024-2-Q2", mode: "study", solvedAt: 5100, sessionId: "session-b", isCorrect: true }),
    ];
    expect(pickLatestExamSession(attempts)).toEqual({ examId: "2024-1", sessionId: "session-a" });
  });

  it("entryType이 random인 시험모드 attempt는 CBT 결과 후보에서 제외한다", () => {
    const attempts = [
      // 오래된 진짜 회차 전체 CBT (entryType: round)
      attempt({ questionId: "2024-1-Q1", mode: "exam", entryType: "round", solvedAt: 1000, sessionId: "session-a", isCorrect: true }),
      // 더 최근이지만 시험모드+랜덤 조합(entryType: random) — 회차 일부만 우연히 건드림
      attempt({ questionId: "2024-1-Q5", mode: "exam", entryType: "random", solvedAt: 9999, sessionId: "session-b", isCorrect: false }),
    ];
    expect(pickLatestExamSession(attempts)).toEqual({ examId: "2024-1", sessionId: "session-a" });
  });

  it("entryType 필드 자체가 없는(undefined) 구버전 attempt는 round로 취급돼서 CBT 후보에 포함된다", () => {
    const legacyAttempt = attempt({ questionId: "2024-1-Q1", mode: "exam", solvedAt: 1000, sessionId: "session-a" });
    // @ts-expect-error entryType이 도입되기 전에 기록된 실제 IndexedDB 데이터를 흉내낸다 — 타입은 required지만 런타임엔 없을 수 있다.
    delete legacyAttempt.entryType;
    expect(pickLatestExamSession([legacyAttempt])).toEqual({ examId: "2024-1", sessionId: "session-a" });
  });
});

describe("scoreExamSession", () => {
  const questions = [question(1, 1), question(2, 1)];

  it("exam모드 정답/오답을 채점하고 합격여부를 판정한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: false, solvedAt: 200 }),
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result).toEqual({ correct: 1, total: 2, passed: false });
  });

  it("같은 세션 안에서 같은 문항을 여러 번 풀었으면 가장 최근 것으로 채점한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: false, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 200 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result).toEqual({ correct: 2, total: 2, passed: true });
  });

  it("다른 회차가 같은 qnum을 써도 섞이지 않는다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-2-Q1", isCorrect: false, solvedAt: 999 }), // 다른 회차의 같은 qnum
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result).toEqual({ correct: 2, total: 2, passed: true });
  });

  it("세션 안에서 exam모드로 안 푼 문항은 오답으로 처리되고 분모에 포함된다", () => {
    const fiveQuestions = [question(1, 1), question(2, 1), question(3, 1), question(4, 1), question(5, 1)];
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
      // Q3~Q5: 이 세션에서 exam모드 attempt 없음
    ];
    const result = scoreExamSession(fiveQuestions, attempts, "2024-1", "session-1");
    expect(result).toEqual({ correct: 2, total: 5, passed: false });
  });

  it("같은 회차를 다른 세션으로 재응시했을 때, 이전 세션의 attempt는 섞이지 않는다", () => {
    const attempts = [
      // 이전 세션: 둘 다 정답
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100, sessionId: "session-old" }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100, sessionId: "session-old" }),
      // 최신 세션: Q1만 다시 풀어서 오답, Q2는 이번 세션에서 안 건드림
      attempt({ questionId: "2024-1-Q1", isCorrect: false, solvedAt: 500, sessionId: "session-new" }),
    ];

    const latest = pickLatestExamSession(attempts);
    expect(latest).toEqual({ examId: "2024-1", sessionId: "session-new" });

    const result = scoreExamSession(questions, attempts, latest!.examId, latest!.sessionId);
    // Q2는 최신 세션에서 안 풀었으므로 오답 처리(이전 세션의 정답이 새어들어오면 안 됨)
    expect(result).toEqual({ correct: 0, total: 2, passed: false });
  });
});
