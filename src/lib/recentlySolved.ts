import type { Attempt } from "@/types/progress";

export function getLastSessionQuestionIds(attempts: Attempt[]): string[] {
  if (attempts.length === 0) return [];

  // sessionId 없는 구버전 attempt는 solvedAt 자체를 세션 키로 써서 각자 독립 세션 취급한다.
  // "legacy-" 접두사로 실제 sessionId(session-* 형식)와 네임스페이스를 분리 — 우연히 같은 ms 값이 나와도 충돌하지 않는다.
  const sessionKey = (a: Attempt) => a.sessionId ?? `legacy-${a.solvedAt}`;

  const latestAttempt = attempts.reduce((latest, a) =>
    a.solvedAt > latest.solvedAt ? a : latest
  );
  const key = sessionKey(latestAttempt);

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const a of [...attempts]
    .filter((x) => sessionKey(x) === key)
    .sort((x, y) => x.solvedAt - y.solvedAt)) {
    if (!seen.has(a.questionId)) {
      seen.add(a.questionId);
      ids.push(a.questionId);
    }
  }
  return ids;
}
