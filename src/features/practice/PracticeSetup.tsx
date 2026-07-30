"use client";

import { useState } from "react";
import { SUBJECT_NAMES } from "@/lib/theory";

export interface PracticeSetupValue {
  subject: number | "all";
  count: 20 | 40 | 100;
}

interface PracticeSetupProps {
  onStart: (value: PracticeSetupValue) => void;
}

export function PracticeSetup({ onStart }: PracticeSetupProps) {
  const [subject, setSubject] = useState<number | "all">("all");
  const [count, setCount] = useState<20 | 40 | 100>(20);

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">학습모드 문제풀이</h1>

      <div className="flex flex-col gap-2">
        <span className="font-medium">과목</span>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setSubject("all")}
            className={`px-3 py-1.5 rounded border ${subject === "all" ? "bg-black text-white" : ""}`}
          >
            통합
          </button>
          {Object.entries(SUBJECT_NAMES).map(([num, name]) => (
            <button
              key={num}
              type="button"
              onClick={() => setSubject(Number(num))}
              className={`px-3 py-1.5 rounded border ${subject === Number(num) ? "bg-black text-white" : ""}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">문항수</span>
        <div className="flex gap-2">
          {([20, 40, 100] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded border ${count === n ? "bg-black text-white" : ""}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onStart({ subject, count })}
        className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium"
      >
        시작
      </button>
    </div>
  );
}
