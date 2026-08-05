import { describe, expect, it } from "vitest";
import { listExamSessions, scoreExamSession } from "./latestExamResult";
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

describe("listExamSessions", () => {
  it("exam모드 attempt가 하나도 없으면 빈 배열", () => {
    expect(listExamSessions([])).toEqual([]);
  });

  it("study모드 attempt만 있으면 빈 배열", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", mode: "study", solvedAt: 1000 }),
      attempt({ questionId: "2024-1-Q2", mode: "study", solvedAt: 1100 }),
    ];
    expect(listExamSessions(attempts)).toEqual([]);
  });

  it("여러 세션을 최근 응시 순으로 전부 나열한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000, sessionId: "session-a" }),
      attempt({ questionId: "2024-2-Q1", solvedAt: 2000, sessionId: "session-b" }),
      attempt({ questionId: "2024-3-Q1", solvedAt: 3000, sessionId: "session-c" }),
    ];
    expect(listExamSessions(attempts)).toEqual([
      { examId: "2024-3", sessionId: "session-c", solvedAt: 3000 },
      { examId: "2024-2", sessionId: "session-b", solvedAt: 2000 },
      { examId: "2024-1", sessionId: "session-a", solvedAt: 1000 },
    ]);
  });

  it("같은 세션 안 여러 attempt 중 최신 solvedAt을 그 세션의 응시일시로 쓴다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", solvedAt: 1000, sessionId: "session-a" }),
      attempt({ questionId: "2024-1-Q2", solvedAt: 1500, sessionId: "session-a" }),
    ];
    expect(listExamSessions(attempts)).toEqual([{ examId: "2024-1", sessionId: "session-a", solvedAt: 1500 }]);
  });

  it("entryType이 random인 세션은 제외한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", entryType: "round", solvedAt: 1000, sessionId: "session-a" }),
      attempt({ questionId: "2024-2-Q1", entryType: "random", solvedAt: 2000, sessionId: "session-b" }),
    ];
    expect(listExamSessions(attempts)).toEqual([{ examId: "2024-1", sessionId: "session-a", solvedAt: 1000 }]);
  });

  it("entryType 필드가 없는(undefined) 구버전 attempt는 round로 취급한다", () => {
    const legacyAttempt = attempt({ questionId: "2024-1-Q1", solvedAt: 1000, sessionId: "session-a" });
    // @ts-expect-error entryType이 도입되기 전 실제 IndexedDB 데이터를 흉내낸다.
    delete legacyAttempt.entryType;
    expect(listExamSessions([legacyAttempt])).toEqual([{ examId: "2024-1", sessionId: "session-a", solvedAt: 1000 }]);
  });
});

describe("scoreExamSession", () => {
  const questions = [question(1, 1), question(2, 1)];

  it("exam모드 정답/오답을 채점하고 합격여부·과목별점수를 리턴한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: false, solvedAt: 200 }),
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result).toEqual({
      correct: 1,
      total: 2,
      passed: false,
      subjectScores: [{ subject: 1, total: 2, correct: 1 }],
    });
  });

  it("과목별 점수를 과목번호 오름차순으로 정렬해서 리턴한다", () => {
    const multiSubjectQuestions = [question(1, 2), question(2, 1)];
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
    ];
    const result = scoreExamSession(multiSubjectQuestions, attempts, "2024-1", "session-1");
    expect(result.subjectScores.map((s) => s.subject)).toEqual([1, 2]);
  });

  it("같은 세션 안에서 같은 문항을 여러 번 풀었으면 가장 최근 것으로 채점한다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: false, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 200 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.passed).toBe(true);
  });

  it("다른 회차가 같은 qnum을 써도 섞이지 않는다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-2-Q1", isCorrect: false, solvedAt: 999 }),
    ];
    const result = scoreExamSession(questions, attempts, "2024-1", "session-1");
    expect(result.correct).toBe(2);
    expect(result.total).toBe(2);
    expect(result.passed).toBe(true);
  });

  it("세션 안에서 exam모드로 안 푼 문항은 오답으로 처리되고 분모에 포함된다", () => {
    const fiveQuestions = [question(1, 1), question(2, 1), question(3, 1), question(4, 1), question(5, 1)];
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100 }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100 }),
    ];
    const result = scoreExamSession(fiveQuestions, attempts, "2024-1", "session-1");
    expect(result.correct).toBe(2);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(false);
    expect(result.subjectScores).toEqual([{ subject: 1, total: 5, correct: 2 }]);
  });

  it("같은 회차를 다른 세션으로 재응시했을 때, 이전 세션의 attempt는 섞이지 않는다", () => {
    const attempts = [
      attempt({ questionId: "2024-1-Q1", isCorrect: true, solvedAt: 100, sessionId: "session-old" }),
      attempt({ questionId: "2024-1-Q2", isCorrect: true, solvedAt: 100, sessionId: "session-old" }),
      attempt({ questionId: "2024-1-Q1", isCorrect: false, solvedAt: 500, sessionId: "session-new" }),
    ];

    const sessions = listExamSessions(attempts);
    expect(sessions[0]).toEqual({ examId: "2024-1", sessionId: "session-new", solvedAt: 500 });

    const result = scoreExamSession(questions, attempts, "2024-1", "session-new");
    expect(result.correct).toBe(0);
    expect(result.total).toBe(2);
    expect(result.passed).toBe(false);
  });
});
