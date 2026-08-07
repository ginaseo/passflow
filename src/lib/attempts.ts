import type { Attempt } from "@/types/progress";

// 같은 세션에서 같은 문항을 재선택하면(시험모드) 여러 attempt row가 쌓일 수 있다
// (#41 이전 데이터, 또는 백업 파일에 남아있는 구버전 데이터). 이 함수는 (questionId,
// sessionId) 쌍마다 가장 늦게 풀이한 row 하나만 남기고 나머지를 "제거 대상"으로 분리한다.
// id가 있는 attempt(이미 IndexedDB에 저장된 것)에서만 의미가 있다 — id 동률 비교는
// 나중에 저장된(더 큰 id) 쪽을 최종값으로 취급한다.
export function dedupeAttemptsBySession(attempts: Attempt[]): {
  kept: Attempt[];
  removedIds: number[];
} {
  const bySessionQuestion = new Map<string, Attempt>();

  for (const a of attempts) {
    const key = `${a.questionId}|${a.sessionId}`;
    const existing = bySessionQuestion.get(key);
    if (
      !existing ||
      a.solvedAt > existing.solvedAt ||
      (a.solvedAt === existing.solvedAt && (a.id ?? 0) > (existing.id ?? 0))
    ) {
      bySessionQuestion.set(key, a);
    }
  }

  const kept = [...bySessionQuestion.values()];
  const keptIds = new Set(kept.map((a) => a.id));
  const removedIds = attempts.filter((a) => a.id !== undefined && !keptIds.has(a.id)).map((a) => a.id!);

  return { kept, removedIds };
}
