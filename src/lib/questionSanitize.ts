import type { PublicQuestion, Question } from "@/types/question";

export function toPublicQuestion(question: Question): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { answer, explanation, ...rest } = question;
  return { ...rest, answerCount: Array.isArray(answer) ? Math.max(1, answer.length) : 1 };
}

export function toPublicQuestions(questions: Question[]): PublicQuestion[] {
  return questions.map(toPublicQuestion);
}

export function assertNoAnswerFields(obj: unknown): void {
  if (obj && typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    if ("answer" in record || "explanation" in record) {
      throw new Error("Response must not include answer or explanation");
    }
  }
}
