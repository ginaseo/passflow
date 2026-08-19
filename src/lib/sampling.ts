import type { PublicQuestion } from "@/types/question";

export function pickRandomQuestions<T extends PublicQuestion>(
  questions: T[],
  count: number,
  rng: () => number = Math.random
): T[] {
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// 랜덤 진입에서 "순차" 순서를 고른 경우 사용 — 셔플하지 않고 examId, qnum
// 순으로 정렬해 앞에서부터 count개를 취한다. 여러 회차가 섞인 풀에서도 한
// 회차씩 순서대로 지나가도록 examId를 먼저 기준으로 둔다.
export function pickSequentialQuestions<T extends PublicQuestion>(questions: T[], count: number): T[] {
  const sorted = [...questions].sort((a, b) => a.examId.localeCompare(b.examId) || a.qnum - b.qnum);
  return sorted.slice(0, Math.min(count, sorted.length));
}

export function pickStratifiedRandomQuestions<T extends PublicQuestion>(
  questions: T[],
  count: number,
  rng: () => number = Math.random,
  weights?: Record<number, number>
): T[] {
  const bySubject = new Map<number, T[]>();
  for (const q of questions) {
    const list = bySubject.get(q.subject) ?? [];
    list.push(q);
    bySubject.set(q.subject, list);
  }

  const subjects = [...bySubject.keys()].sort((a, b) => a - b);
  if (subjects.length === 0) return [];

  // weights가 있으면(예: SQLD 1:4) 비례배분하고, 없으면 기존처럼 과목수로 균등배분한다.
  const quota = new Map<number, number>();
  if (weights) {
    const totalWeight = subjects.reduce((sum, s) => sum + (weights[s] ?? 0), 0);
    if (totalWeight > 0) {
      const raw = subjects.map((s) => ({ subject: s, exact: (count * (weights[s] ?? 0)) / totalWeight }));
      let assigned = 0;
      for (const { subject, exact } of raw) {
        const base = Math.floor(exact);
        quota.set(subject, base);
        assigned += base;
      }
      let remainder = count - assigned;
      const byFraction = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
      for (const { subject } of byFraction) {
        if (remainder <= 0) break;
        quota.set(subject, (quota.get(subject) ?? 0) + 1);
        remainder--;
      }
    }
  }
  if (quota.size === 0) {
    const base = Math.floor(count / subjects.length);
    let remainder = count - base * subjects.length;
    for (const subject of subjects) {
      quota.set(subject, base + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
    }
  }

  // 과목 풀이 배분량보다 작으면 있는 만큼만 쓰고, 모자란 만큼은 아직 여유
  // 있는 다른 과목들에 라운드로빈으로 다시 나눠준다 — 그래야 특정 과목이
  // 적다고 전체 문항수가 조용히 줄어들지 않는다.
  let shortfall = 0;
  for (const subject of subjects) {
    const available = bySubject.get(subject)!.length;
    const want = quota.get(subject)!;
    if (available < want) {
      shortfall += want - available;
      quota.set(subject, available);
    }
  }

  while (shortfall > 0) {
    let distributed = false;
    for (const subject of subjects) {
      if (shortfall <= 0) break;
      const available = bySubject.get(subject)!.length;
      const want = quota.get(subject)!;
      if (want < available) {
        quota.set(subject, want + 1);
        shortfall--;
        distributed = true;
      }
    }
    if (!distributed) break; // 전체 풀이 count보다 작으면 더 나눠줄 데가 없다
  }

  const picked: T[] = [];
  for (const subject of subjects) {
    picked.push(...pickRandomQuestions(bySubject.get(subject)!, quota.get(subject)!, rng));
  }

  return pickRandomQuestions(picked, picked.length, rng);
}
