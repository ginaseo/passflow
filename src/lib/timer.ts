export function elapsedMs(startedAt: number, now: number): number {
  return now - startedAt;
}

export function isTimedOut(startedAt: number, now: number, limitSeconds: number | null): boolean {
  if (limitSeconds === null) return false;
  return elapsedMs(startedAt, now) >= limitSeconds * 1000;
}

// 캘린더 날짜(로컬 자정 기준) 비교 — 자정 직후 조회 시 "오늘"이 지난 24시간으로 새지 않게 한다.
export function isSameLocalDay(timestamp: number, now: number): boolean {
  const a = new Date(timestamp);
  const b = new Date(now);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function remainingMs(startedAt: number, now: number, limitMs: number): number {
  return Math.max(0, startedAt + limitMs - now);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
