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

  const picked: Question[] = [];
  for (const subject of subjects) {
    const take = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    picked.push(...pickRandomQuestions(bySubject.get(subject)!, take, rng));
  }

  return pickRandomQuestions(picked, picked.length, rng);
}
