export function elapsedMs(startedAt: number, now: number): number {
  return now - startedAt;
}

export function isTimedOut(startedAt: number, now: number, limitSeconds: number | null): boolean {
  if (limitSeconds === null) return false;
  return elapsedMs(startedAt, now) >= limitSeconds * 1000;
}
