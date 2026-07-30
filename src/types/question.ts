export interface Question {
  questionId: string;
  examId: string;
  qnum: number;
  stem: string;
  options: string[];
  subject: number;
  answer: number;
  explanation: string;
  image: string | null;
  sinagong?: string;
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
