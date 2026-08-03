// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateStorageFallback,
  isStorageFallbackActive,
  readLocalStorage,
  removeLocalStorageRecord,
  subscribeStorageFallback,
  upsertLocalStorageRecord,
  writeLocalStorage,
} from "./storageFallback";

beforeEach(() => {
  localStorage.clear();
});

describe("storageFallback", () => {
  // 플래그는 모듈 스코프 싱글턴이라 한 번 켜지면 이 파일 내에서는 계속 true다.
  // 아래 세 테스트는 반드시 이 순서(꺼짐 확인 → 켬 → 구독)로 실행되어야 한다.
  it("초기 상태는 비활성", () => {
    expect(isStorageFallbackActive()).toBe(false);
  });

  it("activateStorageFallback 호출 시 활성화되고 리스너에게 알린다", () => {
    const listener = vi.fn();
    subscribeStorageFallback(listener);

    activateStorageFallback();

    expect(isStorageFallbackActive()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("이미 활성 상태에서 다시 호출해도 리스너를 다시 부르지 않는다", () => {
    const listener = vi.fn();
    subscribeStorageFallback(listener);

    activateStorageFallback();

    expect(listener).not.toHaveBeenCalled();
  });

  it("readLocalStorage는 저장된 값이 없으면 fallback을 반환한다", () => {
    expect(readLocalStorage("missing", { a: 1 })).toEqual({ a: 1 });
  });

  it("writeLocalStorage로 저장한 값을 readLocalStorage가 그대로 반환한다", () => {
    writeLocalStorage("key1", { a: 1 });
    expect(readLocalStorage("key1", { a: 0 })).toEqual({ a: 1 });
  });

  it("upsertLocalStorageRecord는 id로 레코드를 추가/갱신한다", () => {
    upsertLocalStorageRecord("notes", "q1", { questionId: "q1", addedAt: 1 });
    upsertLocalStorageRecord("notes", "q2", { questionId: "q2", addedAt: 2 });

    expect(readLocalStorage("notes", {})).toEqual({
      q1: { questionId: "q1", addedAt: 1 },
      q2: { questionId: "q2", addedAt: 2 },
    });
  });

  it("removeLocalStorageRecord는 id로 레코드를 지운다", () => {
    upsertLocalStorageRecord("notes", "q1", { questionId: "q1", addedAt: 1 });

    removeLocalStorageRecord("notes", "q1");

    expect(readLocalStorage("notes", {})).toEqual({});
  });
});
