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

export interface QuestionRepository {
  getQuestion(questionId: string): Promise<PublicQuestion>;
  getQuestions(filter: { examId?: string; subject?: number; examIds?: string[] }): Promise<PublicQuestion[]>;
  // 서로 다른 examId에 흩어진 questionId를 한 번에 조회한다(오답노트/즐겨찾기처럼
  // ID가 뒤섞인 목록을 하나씩 fetch하는 N+1을 피하기 위한 배치 조회). 존재하지
  // 않는 ID는 결과에서 조용히 빠진다 — 호출부가 요청 목록과의 diff로 감지한다.
  getQuestionsByIds(questionIds: string[]): Promise<PublicQuestion[]>;
  getExamIndex(): Promise<ExamSummary[]>;
  getTheoryMap(): Promise<TheoryMap>;
  getMetadata(): Promise<CertMetadata>;
  sampleQuestions(params: SampleParams): Promise<PublicQuestion[]>;
  gradeQuestion(questionId: string, answer: SelectedAnswer): Promise<GradeResult>;
  submitExam(answers: SubmitAnswerItem[]): Promise<SubmitResult>;
}
