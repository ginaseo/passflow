import type { Question } from "@/types/question";

export function pickRandomQuestions(
  questions: Question[],
  count: number,
  rng: () => number = Math.random
): Question[] {
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function pickStratifiedRandomQuestions(
  questions: Question[],
  count: number,
  rng: () => number = Math.random
): Question[] {
  const bySubject = new Map<number, Question[]>();
  for (const q of questions) {
    const list = bySubject.get(q.subject) ?? [];
    list.push(q);
    bySubject.set(q.subject, list);
  }

  const subjects = [...bySubject.keys()].sort((a, b) => a - b);
  if (subjects.length === 0) return [];

  const base = Math.floor(count / subjects.length);
  let remainder = count - base * subjects.length;

  const quota = new Map<number, number>();
  for (const subject of subjects) {
    quota.set(subject, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
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

  const picked: Question[] = [];
  for (const subject of subjects) {
    picked.push(...pickRandomQuestions(bySubject.get(subject)!, quota.get(subject)!, rng));
  }

  return pickRandomQuestions(picked, picked.length, rng);
}
