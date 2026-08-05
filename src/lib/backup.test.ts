import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, parseBackup, serializeBackup } from "./backup";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { Attempt, Favorite, QuestionStats, WrongNote } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 1,
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 500,
    sessionId: "session-1",
    ...overrides,
  };
}

describe("serializeBackup", () => {
  it("attempts의 id 필드를 제외하고 나머지는 그대로 담는다", () => {
    const attempts: Attempt[] = [makeAttempt()];
    const questionStats: QuestionStats[] = [
      { questionId: "Q1", correctCount: 1, wrongCount: 0, lastSolvedAt: 1000 },
    ];
    const wrongNotes: WrongNote[] = [{ questionId: "Q2", addedAt: 2000, mode: "exam" }];
    const favorites: Favorite[] = [{ questionId: "Q3", addedAt: 3000 }];

    const json = serializeBackup({ attempts, questionStats, wrongNotes, favorites, settings: DEFAULT_SETTINGS });
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(typeof parsed.exportedAt).toBe("number");
    expect(parsed.attempts).toEqual([
      {
        questionId: "Q1",
        solvedAt: 1000,
        mode: "study",
        selectedAnswer: 1,
        isCorrect: true,
        solveTimeMs: 500,
        sessionId: "session-1",
      },
    ]);
    expect(parsed.questionStats).toEqual(questionStats);
    expect(parsed.wrongNotes).toEqual(wrongNotes);
    expect(parsed.favorites).toEqual(favorites);
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("parseBackup", () => {
  it("정상적인 백업 JSON을 파싱한다", () => {
    const json = serializeBackup({
      attempts: [makeAttempt()],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    });

    const backup = parseBackup(json);

    expect(backup).not.toBeNull();
    expect(backup?.version).toBe(BACKUP_VERSION);
    expect(backup?.attempts).toHaveLength(1);
  });

  it("JSON 파싱 자체가 실패하면 null을 반환한다", () => {
    expect(parseBackup("이건 JSON이 아니다")).toBeNull();
  });

  it("최상위 필드가 빠져있으면 null을 반환한다", () => {
    expect(parseBackup(JSON.stringify({ version: 1, attempts: [] }))).toBeNull();
  });

  it("version이 다르면 null을 반환한다", () => {
    const json = JSON.stringify({
      version: 999,
      exportedAt: Date.now(),
      attempts: [],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    });
    expect(parseBackup(json)).toBeNull();
  });

  it("settings 필드가 빈 객체면 null을 반환한다", () => {
    const json = JSON.stringify({
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      attempts: [],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: {},
    });
    expect(parseBackup(json)).toBeNull();
  });

  it("settings의 enum 필드 값이 유효하지 않으면 null을 반환한다", () => {
    const json = JSON.stringify({
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      attempts: [],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: { autoSaveWrongNotes: true, defaultMode: "not-a-mode", timeoutBehavior: "wrong" },
    });
    expect(parseBackup(json)).toBeNull();
  });

  it("attempts 원소에 id 필드가 섞여 있어도 결과에서 제거된다", () => {
    const json = JSON.stringify({
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      attempts: [{ ...makeAttempt(), id: 999 }],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    });

    const backup = parseBackup(json);

    expect(backup).not.toBeNull();
    expect(backup?.attempts[0]).not.toHaveProperty("id");
  });

  it("attempts 원소의 필드 타입이 잘못되면 전체를 null로 거부한다", () => {
    const json = JSON.stringify({
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      attempts: [{ ...makeAttempt(), isCorrect: "yes" }],
      questionStats: [],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    });

    expect(parseBackup(json)).toBeNull();
  });

  it("questionStats/wrongNotes/favorites 원소의 필수 필드가 빠지면 null을 반환한다", () => {
    const base = {
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      attempts: [],
      wrongNotes: [],
      favorites: [],
      settings: DEFAULT_SETTINGS,
    };

    expect(
      parseBackup(JSON.stringify({ ...base, questionStats: [{ questionId: "Q1", correctCount: 1 }] }))
    ).toBeNull();
    expect(
      parseBackup(
        JSON.stringify({
          ...base,
          questionStats: [],
          wrongNotes: [{ questionId: "Q1", addedAt: 1000, mode: "invalid-mode" }],
        })
      )
    ).toBeNull();
    expect(
      parseBackup(JSON.stringify({ ...base, questionStats: [], favorites: [{ questionId: "Q1" }] }))
    ).toBeNull();
  });
});
