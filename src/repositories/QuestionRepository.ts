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

export interface QuestionRepository {
  getQuestion(questionId: string): Promise<PublicQuestion>;
  getQuestions(filter: { examId?: string; subject?: number; examIds?: string[] }): Promise<PublicQuestion[]>;
  getExamIndex(): Promise<ExamSummary[]>;
  getTheoryMap(): Promise<TheoryMap>;
  getMetadata(): Promise<CertMetadata>;
  sampleQuestions(params: SampleParams): Promise<PublicQuestion[]>;
  gradeQuestion(questionId: string, answer: number): Promise<GradeResult>;
  submitExam(answers: SubmitAnswerItem[]): Promise<SubmitResult>;
}

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

// Legacy client-side repository — tests only.
import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import type { Question } from "@/types/question";
import { toPublicQuestion } from "@/lib/questionSanitize";

interface RawQuestion {
  qnum: number;
  stem: string;
  options: string[];
  subject: number;
  subjectName?: string;
  answer: number | number[];
  explanation: string;
  image: string | null;
  sinagong?: string;
  table?: string;
  verified?: boolean;
}

interface RawExam {
  examId: string;
  title: string;
  questions: RawQuestion[];
}

export class JsonQuestionRepository implements QuestionRepository {
  private examCache = new Map<string, Promise<Question[]>>();
  private indexCache: Promise<ExamSummary[]> | null = null;
  private theoryMapCache: Promise<TheoryMap> | null = null;
  private metadataCache: Promise<CertMetadata> | null = null;

  constructor(private readonly certId: string) {}

  private loadExam(examId: string): Promise<Question[]> {
    let cached = this.examCache.get(examId);
    if (!cached) {
      cached = fetch(`/data/${this.certId}/exam_${examId}.json`)
        .then((res) => res.json() as Promise<RawExam>)
        .then((raw) =>
          raw.questions.map(
            (q): Question => ({
              questionId: makeQuestionId(this.certId, raw.examId, q.qnum),
              examId: raw.examId,
              qnum: q.qnum,
              stem: q.stem,
              options: q.options,
              subject: q.subject,
              subjectName: q.subjectName,
              answer: q.answer,
              explanation: q.explanation,
              image: q.image ? `${this.certId}/${q.image}` : null,
              sinagong: q.sinagong,
              table: q.table,
              verified: q.verified,
            })
          )
        )
        .catch((err) => {
          this.examCache.delete(examId);
          throw err;
        });
      this.examCache.set(examId, cached);
    }
    return cached;
  }

  private loadIndex(): Promise<ExamSummary[]> {
    if (!this.indexCache) {
      this.indexCache = fetch(`/data/${this.certId}/exams_index.json`)
        .then((res) => res.json() as Promise<ExamSummary[]>)
        .catch((err) => {
          this.indexCache = null;
          throw err;
        });
    }
    return this.indexCache;
  }

  async getTheoryMap(): Promise<TheoryMap> {
    if (!this.theoryMapCache) {
      this.theoryMapCache = fetch(`/data/${this.certId}/theory_map.json`)
        .then((res) => res.json() as Promise<TheoryMap>)
        .catch((err) => {
          console.warn("Failed to load theory_map.json; continuing with an empty map.", err);
          this.theoryMapCache = Promise.resolve({});
          return {};
        });
    }
    return this.theoryMapCache;
  }

  async getExamIndex(): Promise<ExamSummary[]> {
    return this.loadIndex();
  }

  async getMetadata(): Promise<CertMetadata> {
    if (!this.metadataCache) {
      this.metadataCache = this.loadIndex().then(async (exams) => {
        const all = await this.getQuestions({});
        const subjectMap = new Map<number, { subjectName?: string; count: number }>();
        for (const q of all) {
          const prev = subjectMap.get(q.subject);
          subjectMap.set(q.subject, {
            subjectName: q.subjectName ?? prev?.subjectName,
            count: (prev?.count ?? 0) + 1,
          });
        }
        const subjects = [...subjectMap.entries()]
          .map(([subject, { subjectName, count }]) => ({ subject, subjectName, count }))
          .sort((a, b) => a.subject - b.subject);
        const subjectCounts: Record<string, number> = { all: all.length };
        for (const s of subjects) subjectCounts[String(s.subject)] = s.count;
        return { exams, subjects, subjectCounts };
      });
    }
    return this.metadataCache;
  }

  async getQuestion(questionId: string): Promise<PublicQuestion> {
    const { examId, qnum } = parseQuestionId(questionId);
    const questions = await this.loadExam(examId);
    const found = questions.find((q) => q.qnum === qnum);
    if (!found) {
      throw new Error(`문항을 찾을 수 없다: ${questionId}`);
    }
    return toPublicQuestion(found);
  }

  async getQuestions(filter: {
    examId?: string;
    subject?: number;
    examIds?: string[];
  }): Promise<PublicQuestion[]> {
    const examIds = filter.examId
      ? [filter.examId]
      : filter.examIds
        ? filter.examIds
        : (await this.loadIndex()).map((e) => e.examId);

    const perExam = await Promise.all(examIds.map((id) => this.loadExam(id)));
    const all = perExam.flat().map(toPublicQuestion);

    if (filter.subject === undefined) return all;
    return all.filter((q) => q.subject === filter.subject);
  }

  async sampleQuestions(params: SampleParams): Promise<PublicQuestion[]> {
    const { pickRandomQuestions, pickSequentialQuestions, pickStratifiedRandomQuestions } =
      await import("@/lib/sampling");
    const { getSubjectWeights } = await import("@/lib/examSubjectWeights");

    let pool;
    if (params.examIds && params.examIds.length > 0) {
      pool = await this.getQuestions({ examIds: params.examIds });
    } else if (params.subject !== undefined && params.subject !== "all") {
      pool = await this.getQuestions({ subject: params.subject });
    } else {
      pool = await this.getQuestions({});
    }

    const count = Math.min(params.count, pool.length);
    let picked;
    if (params.order === "sequential") {
      picked = pickSequentialQuestions(pool, count);
    } else if (params.stratified !== false && (params.subject === "all" || params.subject === undefined)) {
      picked = pickStratifiedRandomQuestions(
        pool,
        count,
        Math.random,
        getSubjectWeights(this.certId)
      );
    } else {
      picked = pickRandomQuestions(pool, count);
    }
    return picked;
  }

  async gradeQuestion(questionId: string, answer: number): Promise<GradeResult> {
    const { examId, qnum } = parseQuestionId(questionId);
    const questions = await this.loadExam(examId);
    const found = questions.find((q) => q.qnum === qnum);
    if (!found) throw new Error(`문항을 찾을 수 없다: ${questionId}`);
    const { gradeAnswer } = await import("@/lib/grading");
    return {
      correct: gradeAnswer(found, answer),
      correctAnswer: found.answer,
      explanation: found.explanation,
    };
  }

  async submitExam(answers: SubmitAnswerItem[]): Promise<SubmitResult> {
    const { gradeAnswer } = await import("@/lib/grading");
    const results = await Promise.all(
      answers.map(async ({ questionId, selectedAnswer }) => {
        const { examId, qnum } = parseQuestionId(questionId);
        const questions = await this.loadExam(examId);
        const found = questions.find((q) => q.qnum === qnum);
        if (!found) throw new Error(`문항을 찾을 수 없다: ${questionId}`);
        const correct = gradeAnswer(found, selectedAnswer);
        return {
          questionId,
          correct,
          correctAnswer: found.answer,
          explanation: found.explanation,
        };
      })
    );
    const solved = results.length;
    const correct = results.filter((r) => r.correct).length;
    return { results, total: solved, solved, correct, wrong: solved - correct };
  }
}
