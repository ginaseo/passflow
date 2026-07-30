import { describe, expect, it } from "vitest";
import { elapsedMs, isTimedOut } from "./timer";

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
