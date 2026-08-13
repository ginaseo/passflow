// 자격증별 실제 시험의 과목별 문항 비율 — 랜덤+통합 진입 시 이 비율로 문항을
// 배분한다. 없는 자격증은 과목수 균등 배분(기존 동작)으로 폴백한다.
const SUBJECT_WEIGHTS: Record<string, Record<number, number>> = {
  sqld: { 1: 10, 2: 40 }, // 1과목 10문항 : 2과목 40문항 (실제 SQLD 시험 비율)
};

export function getSubjectWeights(certId: string): Record<number, number> | undefined {
  return SUBJECT_WEIGHTS[certId];
}
