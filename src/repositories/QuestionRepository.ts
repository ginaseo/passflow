import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import type { ExamSummary, Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

export interface QuestionRepository {
  getQuestion(questionId: string): Promise<Question>;
  getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]>;
  getExamIndex(): Promise<ExamSummary[]>;
  getTheoryMap(): Promise<TheoryMap>;
}

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

  private loadExam(examId: string): Promise<Question[]> {
    let cached = this.examCache.get(examId);
    if (!cached) {
      cached = fetch(`/data/exam_${examId}.json`)
        .then((res) => res.json() as Promise<RawExam>)
        .then((raw) =>
          raw.questions.map(
            (q): Question => ({
              questionId: makeQuestionId(raw.examId, q.qnum),
              examId: raw.examId,
              qnum: q.qnum,
              stem: q.stem,
              options: q.options,
              subject: q.subject,
              answer: q.answer,
              explanation: q.explanation,
              image: q.image,
              sinagong: q.sinagong,
              table: q.table,
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
      this.indexCache = fetch("/data/exams_index.json")
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
      this.theoryMapCache = fetch("/data/theory_map.json")
        .then((res) => res.json() as Promise<TheoryMap>)
        .catch((err) => {
          this.theoryMapCache = null;
          throw err;
        });
    }
    return this.theoryMapCache;
  }

  async getExamIndex(): Promise<ExamSummary[]> {
    return this.loadIndex();
  }

  async getQuestion(questionId: string): Promise<Question> {
    const { examId, qnum } = parseQuestionId(questionId);
    const questions = await this.loadExam(examId);
    const found = questions.find((q) => q.qnum === qnum);
    if (!found) {
      throw new Error(`문항을 찾을 수 없다: ${questionId}`);
    }
    return found;
  }

  async getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]> {
    const examIds = filter.examId
      ? [filter.examId]
      : (await this.loadIndex()).map((e) => e.examId);

    const perExam = await Promise.all(examIds.map((id) => this.loadExam(id)));
    const all = perExam.flat();

    return filter.subject === undefined
      ? all
      : all.filter((q) => q.subject === filter.subject);
  }
}
