export type PublicQuestion = Omit<Question, "answer" | "explanation">;

export interface Question {
  questionId: string;
  examId: string;
  qnum: number;
  stem: string;
  options: string[];
  subject: number;
  subjectName?: string;
  answer: number | number[];
  explanation: string;
  image: string | null;
  table?: string;
  sinagong?: string;
  verified?: boolean;
}

export interface Exam {
  examId: string;
  title: string;
  questions: Question[];
}

export interface ExamSummary {
  examId: string;
  title: string;
  count: number;
}

export interface CertMetadata {
  exams: ExamSummary[];
  subjects: { subject: number; subjectName?: string; count: number }[];
  subjectCounts: Record<string, number>;
}

export interface SampleParams {
  examIds?: string[];
  subject?: number | "all";
  count: number;
  order: "random" | "sequential";
  stratified?: boolean;
}

export interface GradeResult {
  correct: boolean;
  correctAnswer: number | number[];
  explanation: string;
}

export interface SubmitAnswerItem {
  questionId: string;
  selectedAnswer: number;
}

export interface SubmitResultItem {
  questionId: string;
  correct: boolean;
  correctAnswer: number | number[];
  explanation: string;
}

export interface SubmitResult {
  results: SubmitResultItem[];
  total: number;
  solved: number;
  correct: number;
  wrong: number;
}
