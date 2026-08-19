// answerCount: 정답 개수(대부분 1, "2개 고르시오" 문항은 2) — 어떤 보기가 정답인지는
// 안 드러나지만 몇 개 골라야 하는지는 채점 전에 클라이언트가 알아야 한다("N개를
// 선택하세요" 안내, 선택 초과 방지).
export type PublicQuestion = Omit<Question, "answer" | "explanation"> & { answerCount?: number };

// 정답이 1개인 문항은 number, 2개 이상 고르는 문항(question.answer가 number[])은
// number[]로 선택값을 표현한다 — 정답 개수와 선택 개수가 일치해야 채점된다.
export type SelectedAnswer = number | number[];

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
  selectedAnswer: SelectedAnswer;
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
