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

const theoryMapFixture = {
  "075": { tag: null, name: "스택(Stack)", page: 25, subject: "2과목 소프트웨어 개발" },
};

function mockFetchJson(url: string) {
  const body = url.includes("exams_index")
    ? examsIndexFixture
    : url.includes("theory_map")
      ? theoryMapFixture
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
    const repo = new JsonQuestionRepository("jcg");
    const q = await repo.getQuestion("2023-1-Q2");

    expect(q.questionId).toBe("2023-1-Q2");
    expect(q.examId).toBe("2023-1");
    expect(q.stem).toBe("2번 문항");
    expect(q.sinagong).toBe("075");
    expect(fetch).toHaveBeenCalledWith("/data/jcg/exam_2023-1.json");
  });

  it("getQuestions({ examId })는 해당 회차 문항만 반환한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const qs = await repo.getQuestions({ examId: "2023-1" });
    expect(qs).toHaveLength(2);
    expect(qs[0].questionId).toBe("2023-1-Q1");
  });

  it("getQuestions({ examId, subject })는 회차 내 과목까지 필터링한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const qs = await repo.getQuestions({ examId: "2023-1", subject: 2 });
    expect(qs).toHaveLength(1);
    expect(qs[0].questionId).toBe("2023-1-Q2");
  });

  it("getQuestions({ subject })만 주어지면 exams_index를 읽어 전체 회차를 뒤진다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const qs = await repo.getQuestions({ subject: 1 });
    expect(qs.map((q) => q.questionId).sort()).toEqual(["2023-1-Q1", "2023-2-Q1"]);
  });

  it("같은 회차를 두 번 요청해도 fetch는 한 번만 일어난다 (캐시)", async () => {
    const repo = new JsonQuestionRepository("jcg");
    await repo.getQuestions({ examId: "2023-1" });
    await repo.getQuestions({ examId: "2023-1" });
    const examFetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("exam_2023-1")
    );
    expect(examFetchCalls).toHaveLength(1);
  });

  it("loadExam의 fetch가 실패해도 캐시에 남지 않아 재시도 시 다시 fetch한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const mockFetch = vi.fn(mockFetchJson);
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(repo.getQuestions({ examId: "2023-1" })).rejects.toThrow("network error");

    const qs = await repo.getQuestions({ examId: "2023-1" });
    expect(qs).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("loadIndex의 fetch가 실패해도 캐시에 남지 않아 재시도 시 다시 fetch한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const mockFetch = vi.fn(mockFetchJson);
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(repo.getQuestions({ subject: 1 })).rejects.toThrow("network error");

    const qs = await repo.getQuestions({ subject: 1 });
    expect(qs.map((q) => q.questionId).sort()).toEqual(["2023-1-Q1", "2023-2-Q1"]);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("getTheoryMap은 /data/theory_map.json을 fetch해서 반환한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const map = await repo.getTheoryMap();
    expect(map["075"].name).toBe("스택(Stack)");
    expect(fetch).toHaveBeenCalledWith("/data/jcg/theory_map.json");
  });

  it("RawQuestion의 verified 값을 Question에 그대로 전달한다(false/true/미지정)", async () => {
    const examWithVerified = {
      examId: "2024-1",
      title: "2024년 1회",
      questions: [
        {
          qnum: 1,
          stem: "재구성 문항",
          options: ["a", "b", "c", "d"],
          subject: 1,
          answer: 1,
          explanation: "",
          image: null,
          verified: false,
        },
        {
          qnum: 2,
          stem: "검증된 문항",
          options: ["a", "b", "c", "d"],
          subject: 1,
          answer: 1,
          explanation: "",
          image: null,
          verified: true,
        },
        {
          qnum: 3,
          stem: "verified 미지정 문항",
          options: ["a", "b", "c", "d"],
          subject: 1,
          answer: 1,
          explanation: "",
          image: null,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(examWithVerified),
        } as Response)
      )
    );

    const repo = new JsonQuestionRepository("jcg");
    const qs = await repo.getQuestions({ examId: "2024-1" });

    expect(qs.find((q) => q.qnum === 1)?.verified).toBe(false);
    expect(qs.find((q) => q.qnum === 2)?.verified).toBe(true);
    expect(qs.find((q) => q.qnum === 3)?.verified).toBeUndefined();
  });

  it("getTheoryMap을 두 번 불러도 fetch는 한 번만 일어난다 (캐시)", async () => {
    const repo = new JsonQuestionRepository("jcg");
    await repo.getTheoryMap();
    await repo.getTheoryMap();
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("theory_map")
    );
    expect(calls).toHaveLength(1);
  });

  it("getTheoryMap의 fetch가 실패하면 예외 대신 빈 맵으로 폴백하고, 그 결과를 캐시한다", async () => {
    const repo = new JsonQuestionRepository("jcg");
    const mockFetch = vi.fn(mockFetchJson);
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const map = await repo.getTheoryMap();
    expect(map).toEqual({});

    const mapAgain = await repo.getTheoryMap();
    expect(mapAgain).toEqual({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
