export function makeQuestionId(examId: string, qnum: number): string {
  return `${examId}-Q${qnum}`;
}

export function parseQuestionId(questionId: string): { examId: string; qnum: number } {
  const markerIndex = questionId.lastIndexOf("-Q");
  if (markerIndex === -1) {
    throw new Error(`잘못된 questionId 형식이다: ${questionId}`);
  }
  const examId = questionId.slice(0, markerIndex);
  const qnumPart = questionId.slice(markerIndex + 2);
  const qnum = Number(qnumPart);
  if (examId === "" || qnumPart === "" || !Number.isInteger(qnum)) {
    throw new Error(`잘못된 questionId 형식이다: ${questionId}`);
  }
  return { examId, qnum };
}

// wrongNotes/favorites/attempts는 백업 import로 손상된 questionId가 섞여 들어올 수 있다
// (backup.ts는 questionId를 문자열인지만 검증한다) — UI 렌더링 중 이런 값을 만나도
// 화면 전체가 죽지 않도록, 신뢰할 수 없는 저장 데이터를 다루는 곳에서는 이 버전을 쓴다.
export function tryParseQuestionId(questionId: string): { examId: string; qnum: number } | null {
  try {
    return parseQuestionId(questionId);
  } catch {
    return null;
  }
}
