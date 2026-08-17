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
