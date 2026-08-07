import { describe, expect, it } from "vitest";
import { getUnansweredQuestions, pickResumeExamId, pickResumeSession } from "./resumeExam";
import type { Attempt } from "@/types/progress";
import type { ExamSummary, Question } from "@/types/question";

const exams: ExamSummary[] = [
  { examId: "2024-1", title: "2024년 1회", count: 2 },
  { examId: "2024-2", title: "2024년 2회", count: 2 },
];

function attempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  // sessionStartedAt은 지정 안 하면 solvedAt과 같다고 본다 — 세션당 attempt가 하나뿐인
  // 대부분의 테스트에서 "세션 시작 시각 = 그 답을 고른 시각"으로 자연스럽게 맞아떨어진다.
  // startedAt이 solvedAt과 달라야 하는 테스트는 sessionStartedAt을 직접 오버라이드한다.
  const solvedAt = overrides.solvedAt ?? 0;
  return {
    solvedAt,
    mode: "study",
    entryType: "round",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 0,
    sessionId: "session-1",
    timeLimitMs: null,
    sessionStartedAt: solvedAt,
    ...overrides,
  };
}

function question(examId: string, qnum: number): Question {
  return {
    questionId: `${examId}-Q${qnum}`,
    examId,
    qnum,
    stem: "stem",
    options: ["a", "b"],
    subject: 1,
    answer: 1,
    explanation: "",
    image: null,
  };
}

describe("pickResumeExamId", () => {
  it("진행중인 회차가 없으면 null", () => {
    expect(pickResumeExamId(exams, [])).toBeNull();
  });

  it("완료된 회차는 재개 대상에서 제외한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1" }),
      attempt({ questionId: "2024-1-Q2" }),
    ];
    expect(pickResumeExamId(exams, attempts)).toBeNull();
  });

  it("진행중 회차 중 가장 최근에 손댄 것을 고른다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000 }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 5000 }),
    ];
    expect(pickResumeExamId(exams, attempts)).toBe("2024-2");
  });
});

describe("getUnansweredQuestions", () => {
  it("해당 회차에서 아직 안 푼 문항만 남긴다", () => {
    const questions = [question("2024-1", 1), question("2024-1", 2)];
    const attempts = [attempt({ questionId: "2024-1-Q1" })];
    const result = getUnansweredQuestions(questions, attempts, "2024-1");
    expect(result.map((q) => q.qnum)).toEqual([2]);
  });

  it("다른 회차의 attempt는 영향을 주지 않는다", () => {
    const questions = [question("2024-1", 1)];
    const attempts = [attempt({ questionId: "2024-2-Q1" })];
    const result = getUnansweredQuestions(questions, attempts, "2024-1");
    expect(result.map((q) => q.qnum)).toEqual([1]);
  });
});

describe("pickResumeSession", () => {
  it("해당 회차의 attempt가 없으면 null", () => {
    expect(pickResumeSession([], "2024-1")).toBeNull();
  });

  it("가장 최근 sessionId를 골라 그 세션의 mode/entryType/timeLimitMs를 리턴한다", () => {
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-1-Q1", sessionId: "old", solvedAt: 1000, mode: "study", timeLimitMs: null }),
      attempt({
        questionId: "2024-1-Q1",
        sessionId: "new",
        solvedAt: 5000,
        mode: "exam",
        entryType: "round",
        timeLimitMs: 9000000,
        selectedAnswer: 2,
      }),
    ];
    const result = pickResumeSession(attempts, "2024-1");
    expect(result).toEqual({
      sessionId: "new",
      mode: "exam",
      entryType: "round",
      timeLimitMs: 9000000,
      startedAt: 5000,
      answersByQnum: { 1: 2 },
    });
  });

  it("같은 세션 안 여러 문항의 답을 qnum별로 모은다", () => {
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-1-Q1", sessionId: "s1", solvedAt: 1000, selectedAnswer: 1 }),
      attempt({ questionId: "2024-1-Q2", sessionId: "s1", solvedAt: 2000, selectedAnswer: 3 }),
    ];
    const result = pickResumeSession(attempts, "2024-1");
    expect(result?.answersByQnum).toEqual({ 1: 1, 2: 3 });
  });

  it("같은 세션 안 같은 문항을 재선택했으면 가장 늦은 답만 남긴다", () => {
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-1-Q1", sessionId: "s1", solvedAt: 1000, selectedAnswer: 1 }),
      attempt({ questionId: "2024-1-Q1", sessionId: "s1", solvedAt: 2000, selectedAnswer: 4 }),
    ];
    const result = pickResumeSession(attempts, "2024-1");
    expect(result?.answersByQnum).toEqual({ 1: 4 });
  });

  it("sessionStartedAt이 없으면(구버전 데이터) 그 세션 내 가장 이른 solvedAt으로 근사한다", () => {
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-1-Q1", sessionId: "s1", solvedAt: 3000 }),
      attempt({ questionId: "2024-1-Q2", sessionId: "s1", solvedAt: 1000 }),
      attempt({ questionId: "2024-1-Q3", sessionId: "s1", solvedAt: 2000 }),
    ].map((a) => {
      const legacy = { ...a } as Record<string, unknown>;
      delete legacy.sessionStartedAt;
      return legacy as unknown as Attempt;
    });
    const result = pickResumeSession(attempts, "2024-1");
    expect(result?.startedAt).toBe(1000);
  });

  it("sessionStartedAt이 있으면 첫 문항을 고민한 시간까지 포함한 실제 세션 시작 시각을 쓴다", () => {
    // Q1을 5분 고민하다 500(가상의 세션 시작 시각)에 세션이 시작됐고, 실제 답은 1000에
    // 골랐다 — 예전(=sessionStartedAt 없는) 방식이면 min(solvedAt)인 1000을 썼겠지만,
    // 이제는 실제 시작 시각인 500을 그대로 쓴다.
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-1-Q1", sessionId: "s1", solvedAt: 1000, sessionStartedAt: 500 }),
      attempt({ questionId: "2024-1-Q2", sessionId: "s1", solvedAt: 2000, sessionStartedAt: 500 }),
    ];
    const result = pickResumeSession(attempts, "2024-1");
    expect(result?.startedAt).toBe(500);
  });

  it("다른 회차의 attempt는 무시한다", () => {
    const attempts: Attempt[] = [
      attempt({ questionId: "2024-2-Q1", sessionId: "s1", solvedAt: 1000 }),
    ];
    expect(pickResumeSession(attempts, "2024-1")).toBeNull();
  });
});
