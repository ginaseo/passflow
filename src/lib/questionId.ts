export function makeQuestionId(examId: string, qnum: number): string {
  return `${examId}-Q${qnum}`;
}

export function parseQuestionId(questionId: string): { examId: string; qnum: number } {
  const markerIndex = questionId.lastIndexOf("-Q");
  if (markerIndex === -1) {
    throw new Error(`잘못된 questionId 형식이다: ${questionId}`);
  }
  return {
    examId: questionId.slice(0, markerIndex),
    qnum: Number(questionId.slice(markerIndex + 2)),
  };
}
