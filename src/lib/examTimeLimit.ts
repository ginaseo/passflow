// 자격증별 실제 시험의 "문항당 배정 시간" 비율 — 정처기는 150분/100문항, SQLD는
// 90분/50문항이 기준이다. 시험모드 제한시간은 사용자가 임의로 고르지 않고 이 비율로
// 항상 자동 계산한다(문항수에 비례).
const MINUTES_PER_QUESTION: Record<string, number> = {
  jcg: 1.5,
  sqld: 1.8,
};

export function computeExamTimeLimitMs(certId: string, questionCount: number): number {
  const perQuestion = MINUTES_PER_QUESTION[certId] ?? 1.5;
  return Math.round(questionCount * perQuestion) * 60 * 1000;
}
