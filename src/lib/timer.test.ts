import { describe, expect, it } from "vitest";
import { elapsedMs, formatDuration, isSameLocalDay, isTimedOut, remainingMs } from "./timer";

describe("elapsedMs", () => {
  it("now - startedAt을 반환한다", () => {
    expect(elapsedMs(1000, 2500)).toBe(1500);
  });
});

describe("isTimedOut", () => {
  it("limitSeconds가 null이면 제한 없음 -> 항상 false", () => {
    expect(isTimedOut(0, 999_999_999, null)).toBe(false);
  });

  it("경과시간이 제한을 넘으면 true", () => {
    expect(isTimedOut(0, 61_000, 60)).toBe(true);
  });

  it("경과시간이 제한 이내면 false", () => {
    expect(isTimedOut(0, 59_000, 60)).toBe(false);
  });
});

describe("isSameLocalDay", () => {
  it("같은 날 다른 시각이면 true", () => {
    const morning = new Date(2026, 6, 30, 0, 1).getTime();
    const night = new Date(2026, 6, 30, 23, 59).getTime();
    expect(isSameLocalDay(morning, night)).toBe(true);
  });

  it("자정을 넘겨 10분 차이여도 날짜가 다르면 false (롤링 24시간이 아니라 캘린더 날짜 기준)", () => {
    const beforeMidnight = new Date(2026, 6, 30, 23, 55).getTime();
    const afterMidnight = new Date(2026, 6, 31, 0, 5).getTime();
    expect(isSameLocalDay(beforeMidnight, afterMidnight)).toBe(false);
  });

  it("거의 24시간 가까이 떨어져 있어도 같은 날짜면 true", () => {
    const early = new Date(2026, 6, 30, 0, 30).getTime();
    const late = new Date(2026, 6, 30, 23, 30).getTime();
    expect(isSameLocalDay(early, late)).toBe(true);
  });
});

describe("remainingMs", () => {
  it("제한시간에서 경과시간을 뺀 값을 반환한다", () => {
    expect(remainingMs(0, 30_000, 60_000)).toBe(30_000);
  });

  it("경과시간이 제한시간을 넘으면 0으로 clamp한다", () => {
    expect(remainingMs(0, 90_000, 60_000)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("mm:ss 형식으로 변환한다", () => {
    expect(formatDuration(61_000)).toBe("1:01");
  });

  it("초 단위 미만은 올림 처리한다", () => {
    expect(formatDuration(59_500)).toBe("1:00");
  });

  it("0ms는 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});
