"use client";

import { useEffect, useState } from "react";
import { computeExamStatuses, type ExamStatus } from "@/lib/examStatus";
import { SUBJECT_NAMES } from "@/lib/theory";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Mode } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

export type PracticeSetupValue =
  | {
      mode: Mode;
      entryType: "random";
      subject: number | "all";
      count: 20 | 40 | 100;
      timeLimitMs: number | null;
    }
  | { mode: Mode; entryType: "round"; examId: string; timeLimitMs: number | null };

interface PracticeSetupProps {
  onStart: (value: PracticeSetupValue) => void;
}

const questionRepository = new JsonQuestionRepository();
const progressRepository = new IndexedDbProgressRepository();

const TIME_LIMIT_OPTIONS: { label: string; value: number | null }[] = [
  { label: "제한없음", value: null },
  { label: "30분", value: 30 * 60 * 1000 },
  { label: "60분", value: 60 * 60 * 1000 },
  { label: "150분(실전)", value: 150 * 60 * 1000 },
];

const STATUS_STYLE: Record<ExamStatus, string> = {
  미응시: "text-gray-400",
  진행중: "text-blue-600",
  완료: "text-green-600",
};

export function PracticeSetup({ onStart }: PracticeSetupProps) {
  const [mode, setMode] = useState<Mode>("study");
  const [entryType, setEntryType] = useState<"random" | "round">("random");
  const [subject, setSubject] = useState<number | "all">("all");
  const [count, setCount] = useState<20 | 40 | 100>(20);
  const [timeLimitMs, setTimeLimitMs] = useState<number | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ExamStatus>>(new Map());

  useEffect(() => {
    Promise.all([questionRepository.getExamIndex(), progressRepository.getAttempts()]).then(
      ([examList, attempts]) => {
        setExams(examList);
        setStatuses(computeExamStatuses(examList, attempts));
      },
      (err) => {
        console.error("회차 목록을 불러오지 못했다:", err);
        setExams([]);
      }
    );
  }, []);

  function handleStart() {
    const effectiveTimeLimitMs = mode === "exam" ? timeLimitMs : null;
    if (entryType === "round") {
      if (!examId) return;
      onStart({ mode, entryType: "round", examId, timeLimitMs: effectiveTimeLimitMs });
    } else {
      onStart({
        mode,
        entryType: "random",
        subject,
        count,
        timeLimitMs: effectiveTimeLimitMs,
      });
    }
  }

  const startDisabled = entryType === "round" && !examId;

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">문제풀이</h1>

      <div className="flex flex-col gap-2">
        <span className="font-medium">모드</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("study")}
            className={`px-3 py-1.5 rounded border ${mode === "study" ? "bg-black text-white" : ""}`}
          >
            학습모드
          </button>
          <button
            type="button"
            onClick={() => setMode("exam")}
            className={`px-3 py-1.5 rounded border ${mode === "exam" ? "bg-black text-white" : ""}`}
          >
            시험모드
          </button>
        </div>
      </div>

      {mode === "exam" && (
        <div className="flex flex-col gap-2">
          <span className="font-medium">제한시간</span>
          <div className="flex flex-wrap gap-2">
            {TIME_LIMIT_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setTimeLimitMs(opt.value)}
                className={`px-3 py-1.5 rounded border ${timeLimitMs === opt.value ? "bg-black text-white" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-medium">진입 방식</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntryType("random")}
            className={`px-3 py-1.5 rounded border ${entryType === "random" ? "bg-black text-white" : ""}`}
          >
            랜덤
          </button>
          <button
            type="button"
            onClick={() => setEntryType("round")}
            className={`px-3 py-1.5 rounded border ${entryType === "round" ? "bg-black text-white" : ""}`}
          >
            회차별
          </button>
        </div>
      </div>

      {entryType === "random" ? (
        <>
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
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="font-medium">회차 선택</span>
          {exams === null ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {exams.map((exam) => {
                const status = statuses.get(exam.examId) ?? "미응시";
                return (
                  <button
                    key={exam.examId}
                    type="button"
                    onClick={() => setExamId(exam.examId)}
                    className={`flex justify-between px-3 py-1.5 rounded border ${examId === exam.examId ? "bg-black text-white" : ""}`}
                  >
                    <span>{exam.title}</span>
                    <span className={examId === exam.examId ? "" : STATUS_STYLE[status]}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={startDisabled}
        className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        시작
      </button>
    </div>
  );
}
