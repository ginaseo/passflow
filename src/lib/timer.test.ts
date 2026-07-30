import { describe, expect, it } from "vitest";
import { elapsedMs, isSameLocalDay, isTimedOut } from "./timer";

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
