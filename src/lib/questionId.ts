const DEFAULT_CERT_ID = "jcg";

// jcg는 자격증 구분이 생기기 전부터 쌓여온 기본 자격증이라 접두사를 붙이지 않는다 —
// 붙이면 기존 사용자의 IndexedDB에 남아있는 구형식 키("2023-1-Q5")와 앞으로 새로
// 생성되는 신형식 키("jcg:2023-1-Q5")가 같은 문항인데 서로 다른 키가 돼서 오답노트·
// 즐겨찾기·풀이통계가 갈라진다(마이그레이션 없이는 못 고침). jcg 외 다른 자격증만
// examId 충돌 방지를 위해 접두사를 붙인다.
export function makeQuestionId(certId: string, examId: string, qnum: number): string {
  const prefix = certId === DEFAULT_CERT_ID ? "" : `${certId}:`;
  return `${prefix}${examId}-Q${qnum}`;
}

// "certId:" 접두사가 없는 questionId는 jcg로 취급한다(위 makeQuestionId 설명 참고).
export function parseQuestionId(questionId: string): { certId: string; examId: string; qnum: number } {
  const qMarkerIndex = questionId.lastIndexOf("-Q");
  if (qMarkerIndex === -1) {
    throw new Error(`잘못된 questionId 형식이다: ${questionId}`);
  }
  const beforeQ = questionId.slice(0, qMarkerIndex);
  const qnumPart = questionId.slice(qMarkerIndex + 2);
  const qnum = Number(qnumPart);

  const colonIndex = beforeQ.indexOf(":");
  const certId = colonIndex === -1 ? DEFAULT_CERT_ID : beforeQ.slice(0, colonIndex);
  const examId = colonIndex === -1 ? beforeQ : beforeQ.slice(colonIndex + 1);

  if (examId === "" || qnumPart === "" || !Number.isInteger(qnum)) {
    throw new Error(`잘못된 questionId 형식이다: ${questionId}`);
  }
  return { certId, examId, qnum };
}

// wrongNotes/favorites/attempts는 백업 import로 손상된 questionId가 섞여 들어올 수 있다
// (backup.ts는 questionId를 문자열인지만 검증한다) — UI 렌더링 중 이런 값을 만나도
// 화면 전체가 죽지 않도록, 신뢰할 수 없는 저장 데이터를 다루는 곳에서는 이 버전을 쓴다.
export function tryParseQuestionId(questionId: string): { certId: string; examId: string; qnum: number } | null {
  try {
    return parseQuestionId(questionId);
  } catch {
    return null;
  }
}
