import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import { toPublicQuestion } from "@/lib/questionSanitize";
import type { CertMetadata, ExamSummary, GradeResult, PublicQuestion, SampleParams, SelectedAnswer, SubmitAnswerItem, SubmitResult } from "@/types/question";
import type { TheoryMap } from "@/types/theory";
import type { QuestionRepository } from "@/repositories/QuestionRepository";

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
  private examCache = new Map<string, Promise<import("@/types/question").Question[]>>();
  private indexCache: Promise<ExamSummary[]> | null = null;
  private theoryMapCache: Promise<TheoryMap> | null = null;
  private metadataCache: Promise<CertMetadata> | null = null;

  constructor(private readonly certId: string) {}

  private loadExam(examId: string): Promise<import("@/types/question").Question[]> {
    let cached = this.examCache.get(examId);
    if (!cached) {
      cached = fetch(`/data/${this.certId}/exam_${examId}.json`)
        .then((res) => {
          if (!res.ok) throw new Error(`exam_${examId}.json 조회 실패: ${res.status}`);
          return res.json() as Promise<RawExam>;
        })
        .then((raw) =>
          raw.questions.map(
            (q): import("@/types/question").Question => ({
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
        .then((res) => {
          if (!res.ok) throw new Error(`exams_index.json 조회 실패: ${res.status}`);
          return res.json() as Promise<ExamSummary[]>;
        })
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
        .then((res) => {
          if (!res.ok) throw new Error(`theory_map.json 조회 실패: ${res.status}`);
          return res.json() as Promise<TheoryMap>;
        })
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
      this.metadataCache = this.loadIndex()
        .then(async (exams) => {
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
        })
        .catch((err) => {
          // 실패한 프로미스를 캐시에 남기면 이후 모든 호출이 재시도 없이 같은
          // 오류를 반환한다 — loadExam/loadIndex와 동일하게 실패 시 비운다.
          this.metadataCache = null;
          throw err;
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

    let pool: PublicQuestion[];
    if (params.examIds && params.examIds.length > 0) {
      pool = await this.getQuestions({ examIds: params.examIds });
    } else if (params.subject !== undefined && params.subject !== "all") {
      pool = await this.getQuestions({ subject: params.subject });
    } else {
      pool = await this.getQuestions({});
    }

    const count = Math.min(params.count, pool.length);
    let picked: PublicQuestion[];
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

  async gradeQuestion(questionId: string, answer: SelectedAnswer): Promise<GradeResult> {
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
