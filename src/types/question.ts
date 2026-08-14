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
  // false면 원본 출처에 실제 정답이 없어 AI가 추측 없이 새로 구성한 문항이라는 뜻 —
  // 실제 기출과 다를 수 있다. true/미지정(대부분)은 원 출처의 정답을 그대로 썼다는 뜻.
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
