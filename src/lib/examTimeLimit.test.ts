import { describe, expect, it } from "vitest";
import { computeExamTimeLimitMs } from "./examTimeLimit";

describe("computeExamTimeLimitMs", () => {
  it("정처기: 문항수 20/50/100 -> 30/75/150분", () => {
    expect(computeExamTimeLimitMs("jcg", 20)).toBe(30 * 60 * 1000);
    expect(computeExamTimeLimitMs("jcg", 50)).toBe(75 * 60 * 1000);
    expect(computeExamTimeLimitMs("jcg", 100)).toBe(150 * 60 * 1000);
  });

  it("SQLD: 90분/50문항 비율(1.8분/문항)로 계산한다", () => {
    expect(computeExamTimeLimitMs("sqld", 50)).toBe(90 * 60 * 1000);
    expect(computeExamTimeLimitMs("sqld", 20)).toBe(36 * 60 * 1000);
  });

  it("모르는 자격증은 정처기 비율(1.5분/문항)로 폴백한다", () => {
    expect(computeExamTimeLimitMs("unknown", 20)).toBe(30 * 60 * 1000);
  });
});
