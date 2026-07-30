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
