import type {
  CertMetadata,
  ExamSummary,
  GradeResult,
  PublicQuestion,
  SampleParams,
  SelectedAnswer,
  SubmitAnswerItem,
  SubmitResult,
} from "@/types/question";
import type { TheoryMap } from "@/types/theory";
import type { QuestionRepository } from "@/repositories/QuestionRepository";

export class ApiAccessError extends Error {
  constructor(message = "API access denied") {
    super(message);
    this.name = "ApiAccessError";
  }
}

// 오답노트/즐겨찾기에 남은 questionId가 데이터 개편으로 더 이상 존재하지 않을 때
// (examId 체계 변경 등) 구분해서 잡아야, 호출부가 "진짜 없음"과 네트워크 오류를
// 구별해 자동으로 정리할 수 있다.
export class QuestionNotFoundError extends Error {
  constructor(message = "Question not found") {
    super(message);
    this.name = "QuestionNotFoundError";
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    throw new ApiAccessError();
  }

  if (res.status === 404) {
    throw new QuestionNotFoundError();
  }

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function mapImageUrl(question: PublicQuestion): PublicQuestion {
  if (!question.image) return question;

  return {
    ...question,
    image: question.image.startsWith("/api/media/")
        ? question.image
        : `/api/media/${question.image}`,
  };
}

export class ApiQuestionRepository implements QuestionRepository {
  constructor(private readonly certId: string) {}

  async getMetadata(): Promise<CertMetadata> {
    return apiFetch(`/api/${this.certId}/metadata`);
  }

  async getExamIndex(): Promise<ExamSummary[]> {
    const metadata = await this.getMetadata();
    return metadata.exams;
  }

  async getTheoryMap(): Promise<TheoryMap> {
    try {
      return await apiFetch(`/api/${this.certId}/theory-map`);
    } catch {
      return {};
    }
  }

  async getQuestion(questionId: string): Promise<PublicQuestion> {
    const q = await apiFetch<PublicQuestion>(
        `/api/${this.certId}/questions/${encodeURIComponent(questionId)}`
    );
    return mapImageUrl(q);
  }

  async getQuestions(filter: {
    examId?: string;
    subject?: number;
    examIds?: string[];
  }): Promise<PublicQuestion[]> {
    if (filter.examId) {
      const qs = await apiFetch<PublicQuestion[]>(
          `/api/${this.certId}/exams/${encodeURIComponent(filter.examId)}/questions`
      );
      const mapped = qs.map((q) => mapImageUrl(q));
      return filter.subject === undefined
          ? mapped
          : mapped.filter((q) => q.subject === filter.subject);
    }

    if (filter.examIds && filter.examIds.length > 0) {
      const perExam = await Promise.all(
          filter.examIds.map((examId) =>
              apiFetch<PublicQuestion[]>(
                  `/api/${this.certId}/exams/${encodeURIComponent(examId)}/questions`
              )
          )
      );
      const all = perExam.flat().map((q) => mapImageUrl(q));
      return filter.subject === undefined
          ? all
          : all.filter((q) => q.subject === filter.subject);
    }

    if (filter.subject !== undefined) {
      return this.sampleQuestions({
        subject: filter.subject,
        count: Number.MAX_SAFE_INTEGER,
        order: "sequential",
        stratified: false,
      });
    }

    throw new Error("getQuestions requires examId, examIds, or subject filter");
  }

  async sampleQuestions(params: SampleParams): Promise<PublicQuestion[]> {
    const qs = await apiFetch<PublicQuestion[]>(
        `/api/${this.certId}/questions/sample`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
    );

    return qs.map((q) => mapImageUrl(q));
  }

  async gradeQuestion(
      questionId: string,
      answer: SelectedAnswer
  ): Promise<GradeResult> {
    return apiFetch<GradeResult>(
        `/api/${this.certId}/questions/${encodeURIComponent(questionId)}/grade`,
        {
          method: "POST",
          body: JSON.stringify({ answer }),
        }
    );
  }

  async submitExam(answers: SubmitAnswerItem[]): Promise<SubmitResult> {
    return apiFetch<SubmitResult>(
        `/api/${this.certId}/exams/submit`,
        {
          method: "POST",
          body: JSON.stringify({ answers }),
        }
    );
  }
}
