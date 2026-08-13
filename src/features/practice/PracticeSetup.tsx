"use client";

import { useEffect, useState } from "react";
import { computeExamStatuses, type ExamStatus } from "@/lib/examStatus";
import { getSubjectLabel } from "@/lib/theory";
import { computeExamTimeLimitMs } from "@/lib/examTimeLimit";
import type { QuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Mode } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

export type PracticeSetupValue =
  | {
      mode: Mode;
      entryType: "random";
      subject: number | "all";
      count: number;
      timeLimitMs: number | null;
    }
  | { mode: Mode; entryType: "round"; examId: string; timeLimitMs: number | null };

interface PracticeSetupProps {
  questionRepository: QuestionRepository;
  certId: string;
  onStart: (value: PracticeSetupValue) => void;
  initialEntryType?: "random" | "round";
  initialMode?: Mode;
  initialSubject?: number | "all";
  initialCount?: number;
}

const progressRepository = new IndexedDbProgressRepository();

const STATUS_STYLE: Record<ExamStatus, string> = {
  미응시: "text-gray-400",
  진행중: "text-blue-600",
  완료: "text-green-600",
};

// 자격증별 실제 시험 문항수를 기준으로 한 랜덤모드 문항수 선택지 — 정처기는
// 100문항 시험의 20%/40%/100%, SQLD는 50문항 시험의 20%/40%/100%에 대응한다.
const COUNT_OPTIONS: Record<string, number[]> = {
  jcg: [20, 40, 100],
  sqld: [10, 25, 50],
};

export function PracticeSetup({
  questionRepository,
  certId,
  onStart,
  initialEntryType,
  initialMode,
  initialSubject,
  initialCount,
}: PracticeSetupProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "study");
  const [timeLimitMode, setTimeLimitMode] = useState<"auto" | "none">("none");
  const [entryType, setEntryType] = useState<"random" | "round">(initialEntryType ?? "random");
  const [subject, setSubject] = useState<number | "all">(initialSubject ?? "all");
  const countOptions = COUNT_OPTIONS[certId] ?? COUNT_OPTIONS.jcg;
  const [count, setCount] = useState<number>(initialCount ?? countOptions[1]);
  const [examId, setExamId] = useState<string | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ExamStatus>>(new Map());
  const [subjects, setSubjects] = useState<{ subject: number; subjectName?: string }[]>([]);

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

    // 과목 버튼 목록만을 위해 전체 문항을 내려받는다 — 회차 목록·상태 표시는 위
    // 요청과 분리해서 이걸 기다리지 않고 먼저 뜨게 한다(전체 문항 fetch는 자격증
    // 회차가 많을수록 오래 걸릴 수 있다). 여기서 채운 캐시는 "시작" 시 재사용된다.
    questionRepository.getQuestions({}).then(
      (allQuestions) => {
        const subjectList = [...new Map(allQuestions.map((q) => [q.subject, q.subjectName] as const)).entries()]
          .map(([subject, subjectName]) => ({ subject, subjectName }))
          .sort((a, b) => a.subject - b.subject);
        setSubjects(subjectList);
        // URL(예: 오래된 북마크)로 들어온 초기 과목값이 이 자격증엔 없는 과목번호일
        // 수 있다 — 그 경우 빈 문항 목록으로 조용히 실패하는 대신 "통합"으로 되돌린다.
        setSubject((prev) => (prev === "all" || subjectList.some((s) => s.subject === prev) ? prev : "all"));
      },
      (err) => console.error("과목 목록을 불러오지 못했다:", err)
    );
  }, [questionRepository]);

  // 제한시간 값 자체는 사용자가 고르지 않는다 — 자격증별 실제 시험의 문항당 배정
  // 시간 비율로 항상 자동 계산한다(회차별은 그 회차의 실제 문항수 기준). 다만
  // 시험모드에서 그 자동값을 적용할지, 아예 제한없음으로 풀지는 고를 수 있다.
  const roundQuestionCount = examId ? (exams?.find((e) => e.examId === examId)?.count ?? 0) : 0;
  const autoTimeLimitMs =
    mode === "exam"
      ? computeExamTimeLimitMs(certId, entryType === "round" ? roundQuestionCount : count)
      : null;
  const timeLimitMs = timeLimitMode === "auto" ? autoTimeLimitMs : null;

  function handleStart() {
    if (entryType === "round") {
      if (!examId) return;
      onStart({ mode, entryType: "round", examId, timeLimitMs });
    } else {
      onStart({
        mode,
        entryType: "random",
        subject,
        count,
        timeLimitMs,
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTimeLimitMode("none")}
              className={`px-3 py-1.5 rounded border ${timeLimitMode === "none" ? "bg-black text-white" : ""}`}
            >
              제한없음
            </button>
            <button
              type="button"
              onClick={() => setTimeLimitMode("auto")}
              className={`px-3 py-1.5 rounded border ${timeLimitMode === "auto" ? "bg-black text-white" : ""}`}
            >
              {autoTimeLimitMs
                ? `${Math.round(autoTimeLimitMs / 60000)}분`
                : entryType === "round" && !examId
                  ? "자동"
                  : "-"}
            </button>
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
              {subjects.map(({ subject: num, subjectName }) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSubject(num)}
                  className={`px-3 py-1.5 rounded border ${subject === num ? "bg-black text-white" : ""}`}
                >
                  {getSubjectLabel({ subject: num, subjectName })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium">문항수</span>
            <div className="flex gap-2">
              {countOptions.map((n) => (
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
