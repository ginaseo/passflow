import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import { getServerDataDir } from "@/lib/serverDataPath";
import { CERT_LABELS } from "@/lib/certLabels";
import type { CertInfo } from "@/lib/cert";
import type { CertMetadata, ExamSummary, Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

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

function mapRawQuestions(certId: string, raw: RawExam): Question[] {
  return raw.questions.map(
    (q): Question => ({
      questionId: makeQuestionId(certId, raw.examId, q.qnum),
      examId: raw.examId,
      qnum: q.qnum,
      stem: q.stem,
      options: q.options,
      subject: q.subject,
      subjectName: q.subjectName,
      answer: q.answer,
      explanation: q.explanation,
      image: q.image ? `${certId}/${q.image}` : null,
      sinagong: q.sinagong,
      table: q.table,
      verified: q.verified,
    })
  );
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const nonStandardIndexCache = new Map<string, ExamSummary[]>();

function ensureStandardLayout(certDir: string): void {
  if (existsSync(join(certDir, "exams_index.json"))) return;

  const names = readdirSync(certDir).filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  const examSummaries: ExamSummary[] = [];

  for (const name of names) {
    if (name === "exams_index.json" || name === "theory_map.json") continue;
    const raw = readJsonFile<RawExam>(join(certDir, name));
    const examId = String(raw.examId ?? basename(name, ".json"));
    const title = String(raw.title ?? examId);
    const questions = Array.isArray(raw.questions) ? raw.questions : [];
    examSummaries.push({ examId, title, count: questions.length });
  }

  nonStandardIndexCache.set(certDir, examSummaries);
}

function getExamSummaries(certDir: string): ExamSummary[] {
  const indexPath = join(certDir, "exams_index.json");
  if (existsSync(indexPath)) {
    return readJsonFile<ExamSummary[]>(indexPath);
  }

  ensureStandardLayout(certDir);
  return nonStandardIndexCache.get(certDir) ?? [];
}

function listExamIds(certDir: string): string[] {
  if (existsSync(join(certDir, "exams_index.json"))) {
    return getExamSummaries(certDir).map((e) => e.examId);
  }

  return readdirSync(certDir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .filter((name) => name !== "exams_index.json" && name !== "theory_map.json")
    .map((name) => {
      const raw = readJsonFile<RawExam>(join(certDir, name));
      return String(raw.examId ?? basename(name, ".json"));
    });
}

export class FsQuestionRepository {
  private examCache = new Map<string, Question[]>();
  private indexCache: ExamSummary[] | null = null;
  private theoryMapCache: TheoryMap | null = null;
  private readonly certDir: string;

  constructor(private readonly certId: string) {
    this.certDir = join(getServerDataDir(), certId);
    if (!existsSync(this.certDir)) {
      throw new Error(`Cert dataset not found: ${certId}`);
    }
  }

  private loadExam(examId: string): Question[] {
    let cached = this.examCache.get(examId);
    if (cached) return cached;

    let raw: RawExam;
    const standardPath = join(this.certDir, `exam_${examId}.json`);
    if (existsSync(standardPath)) {
      raw = readJsonFile<RawExam>(standardPath);
    } else {
      const match = readdirSync(this.certDir).find((name) => {
        if (!name.endsWith(".json") || name.startsWith("_")) return false;
        const candidate = readJsonFile<RawExam>(join(this.certDir, name));
        const id = String(candidate.examId ?? basename(name, ".json"));
        return id === examId;
      });
      if (!match) throw new Error(`Exam not found: ${examId}`);
      raw = readJsonFile<RawExam>(join(this.certDir, match));
    }

    cached = mapRawQuestions(this.certId, raw);
    this.examCache.set(examId, cached);
    return cached;
  }

  getExamIndex(): ExamSummary[] {
    if (!this.indexCache) {
      this.indexCache = getExamSummaries(this.certDir);
    }
    return this.indexCache;
  }

  getTheoryMap(): TheoryMap {
    if (this.theoryMapCache) return this.theoryMapCache;
    const path = join(this.certDir, "theory_map.json");
    if (!existsSync(path)) {
      this.theoryMapCache = {};
      return this.theoryMapCache;
    }
    try {
      this.theoryMapCache = readJsonFile<TheoryMap>(path);
    } catch {
      this.theoryMapCache = {};
    }
    return this.theoryMapCache;
  }

  getQuestion(questionId: string): Question {
    const { examId, qnum } = parseQuestionId(questionId);
    const questions = this.loadExam(examId);
    const found = questions.find((q) => q.qnum === qnum);
    if (!found) {
      throw new Error(`Question not found: ${questionId}`);
    }
    return found;
  }

  // review/dashboard가 questionId마다 개별 조회하던 N+1을 없애기 위한 배치 조회 —
  // examId별로 그룹핑해 시험 파일을 한 번씩만 읽는다.
  getQuestionsByIds(questionIds: string[]): Question[] {
    const byExam = new Map<string, number[]>();
    for (const id of questionIds) {
      const { examId, qnum } = parseQuestionId(id);
      const qnums = byExam.get(examId);
      if (qnums) qnums.push(qnum);
      else byExam.set(examId, [qnum]);
    }

    const result: Question[] = [];
    for (const [examId, qnums] of byExam) {
      const qnumSet = new Set(qnums);
      let questions: Question[];
      try {
        questions = this.loadExam(examId);
      } catch {
        continue; // 더 이상 존재하지 않는 examId는 조용히 건너뛴다(호출부가 diff로 감지)
      }
      for (const q of questions) {
        if (qnumSet.has(q.qnum)) result.push(q);
      }
    }
    return result;
  }

  getQuestions(filter: { examId?: string; subject?: number; examIds?: string[] }): Question[] {
    let examIds: string[];
    if (filter.examId) {
      examIds = [filter.examId];
    } else if (filter.examIds) {
      examIds = filter.examIds;
    } else {
      examIds = listExamIds(this.certDir);
    }

    const all = examIds.flatMap((id) => this.loadExam(id));
    if (filter.subject === undefined) return all;
    return all.filter((q) => q.subject === filter.subject);
  }

  getMetadata(): CertMetadata {
    const exams = this.getExamIndex();
    const all = this.getQuestions({});
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
    for (const s of subjects) {
      subjectCounts[String(s.subject)] = s.count;
    }

    return { exams, subjects, subjectCounts };
  }
}

const repoCache = new Map<string, FsQuestionRepository>();

export function getFsQuestionRepository(certId: string): FsQuestionRepository {
  let repo = repoCache.get(certId);
  if (!repo) {
    repo = new FsQuestionRepository(certId);
    repoCache.set(certId, repo);
  }
  return repo;
}

export function listCertificates(): CertInfo[] {
  const root = getServerDataDir();
  const certsPath = join(root, "certs.json");
  if (existsSync(certsPath)) {
    return readJsonFile<CertInfo[]>(certsPath);
  }

  return readdirSync(root)
    .filter((name) => {
      try {
        return statSync(join(root, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((id) => ({ id, label: CERT_LABELS[id] ?? id }));
}
