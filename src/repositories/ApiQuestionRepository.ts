import type {
  CertMetadata,
  ExamSummary,
  GradeResult,
  PublicQuestion,
  SampleParams,
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
      const mapped = qs.map(mapImageUrl);
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
      const all = perExam.flat().map(mapImageUrl);
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
    const qs = await apiFetch<PublicQuestion[]>(`/api/${this.certId}/questions/sample`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    return qs.map(mapImageUrl);
  }

  async gradeQuestion(questionId: string, answer: number): Promise<GradeResult> {
    return apiFetch<GradeResult>(
      `/api/${this.certId}/questions/${encodeURIComponent(questionId)}/grade`,
      {
        method: "POST",
        body: JSON.stringify({ answer }),
      }
    );
  }

  async submitExam(answers: SubmitAnswerItem[]): Promise<SubmitResult> {
    return apiFetch<SubmitResult>(`/api/${this.certId}/exams/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }
}
