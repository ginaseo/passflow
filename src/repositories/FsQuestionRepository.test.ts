import { describe, expect, it, beforeAll } from "vitest";
import { join } from "node:path";
import { getFsQuestionRepository } from "./FsQuestionRepository";
import { toPublicQuestion } from "@/lib/questionSanitize";

const DATA_DIR = process.env.PASSFLOW_DATA_DIR ?? join(process.cwd(), "..", "passflow-data", "data");

describe("FsQuestionRepository", () => {
  beforeAll(() => {
    process.env.PASSFLOW_DATA_DIR = DATA_DIR;
  });

  it("loads exam index for jcg", () => {
    const repo = getFsQuestionRepository("jcg");
    const exams = repo.getExamIndex();
    expect(exams.length).toBeGreaterThan(0);
  });

  it("getQuestion returns full question with answer on server", () => {
    const repo = getFsQuestionRepository("jcg");
    const exams = repo.getExamIndex();
    const examId = exams[0]?.examId;
    expect(examId).toBeTruthy();
    const questions = repo.getQuestions({ examId });
    expect(questions.length).toBeGreaterThan(0);
    const q = repo.getQuestion(questions[0].questionId);
    expect(q.answer).toBeDefined();
  });

  it("toPublicQuestion strips answer and explanation", () => {
    const repo = getFsQuestionRepository("jcg");
    const exams = repo.getExamIndex();
    const questions = repo.getQuestions({ examId: exams[0].examId });
    const pub = toPublicQuestion(questions[0]);
    expect(pub).not.toHaveProperty("answer");
    expect(pub).not.toHaveProperty("explanation");
    expect(pub.stem).toBe(questions[0].stem);
  });

  it("getMetadata returns subject counts without loading client", () => {
    const repo = getFsQuestionRepository("jcg");
    const metadata = repo.getMetadata();
    expect(metadata.subjects.length).toBeGreaterThan(0);
    expect(metadata.subjectCounts.all).toBeGreaterThan(0);
  });

  it("throws for missing cert", () => {
    expect(() => getFsQuestionRepository("nonexistent-cert-xyz")).toThrow();
  });
});
