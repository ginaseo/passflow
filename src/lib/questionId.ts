export function makeQuestionId(examId: string, qnum: number): string {
  return `${examId}-Q${qnum}`;
}

export function parseQuestionId(questionId: string): { examId: string; qnum: number } {
  const markerIndex = questionId.lastIndexOf("-Q");
  return {
    examId: questionId.slice(0, markerIndex),
    qnum: Number(questionId.slice(markerIndex + 2)),
  };
}
