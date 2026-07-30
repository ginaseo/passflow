import { beforeEach, describe, expect, it, vi } from "vitest";
import { JsonQuestionRepository } from "./QuestionRepository";

const examsIndexFixture = [
  { examId: "2023-1", title: "2023년 1회", count: 2 },
  { examId: "2023-2", title: "2023년 2회", count: 1 },
];

const exam2023_1 = {
  examId: "2023-1",
  title: "2023년 1회",
  questions: [
    {
      qnum: 1,
      stem: "1번 문항",
      options: ["a", "b", "c", "d"],
      subject: 1,
      subjectName: "소프트웨어 설계",
      answer: 1,
      explanation: "",
      image: null,
    },
    {
      qnum: 2,
      stem: "2번 문항",
      options: ["a", "b", "c", "d"],
      subject: 2,
      subjectName: "소프트웨어 개발",
      answer: 2,
      explanation: "",
      image: null,
      sinagong: "075",
    },
  ],
};

const exam2023_2 = {
  examId: "2023-2",
  title: "2023년 2회",
  questions: [
    {
      qnum: 1,
      stem: "다른 회차 1번",
      options: ["a", "b", "c", "d"],
      subject: 1,
      subjectName: "소프트웨어 설계",
      answer: 3,
      explanation: "",
      image: null,
    },
  ],
};

function mockFetchJson(url: string) {
  const body = url.includes("exams_index")
    ? examsIndexFixture
    : url.includes("exam_2023-1")
      ? exam2023_1
      : exam2023_2;
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetchJson));
});

describe("JsonQuestionRepository", () => {
  it("getQuestion은 examId-Qqnum 형식을 파싱해 해당 문항을 questionId·examId를 채워 반환한다", async () => {
    const repo = new JsonQuestionRepository();
    const q = await repo.getQuestion("2023-1-Q2");

    expect(q.questionId).toBe("2023-1-Q2");
    expect(q.examId).toBe("2023-1");
    expect(q.stem).toBe("2번 문항");
    expect(q.sinagong).toBe("075");
    expect(fetch).toHaveBeenCalledWith("/data/exam_2023-1.json");
  });

  it("getQuestions({ examId })는 해당 회차 문항만 반환한다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ examId: "2023-1" });
    expect(qs).toHaveLength(2);
    expect(qs[0].questionId).toBe("2023-1-Q1");
  });

  it("getQuestions({ examId, subject })는 회차 내 과목까지 필터링한다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ examId: "2023-1", subject: 2 });
    expect(qs).toHaveLength(1);
    expect(qs[0].questionId).toBe("2023-1-Q2");
  });

  it("getQuestions({ subject })만 주어지면 exams_index를 읽어 전체 회차를 뒤진다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ subject: 1 });
    expect(qs.map((q) => q.questionId).sort()).toEqual(["2023-1-Q1", "2023-2-Q1"]);
  });

  it("같은 회차를 두 번 요청해도 fetch는 한 번만 일어난다 (캐시)", async () => {
    const repo = new JsonQuestionRepository();
    await repo.getQuestions({ examId: "2023-1" });
    await repo.getQuestions({ examId: "2023-1" });
    const examFetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("exam_2023-1")
    );
    expect(examFetchCalls).toHaveLength(1);
  });
});
