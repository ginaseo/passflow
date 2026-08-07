"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { listExamSessions, scoreExamSession } from "@/lib/latestExamResult";
import type { SubjectScore } from "@/lib/summary";
import { SUBJECT_NAMES } from "@/lib/theory";
import type { DashboardSummary } from "@/types/progress";

const progressRepository = new IndexedDbProgressRepository();
const questionRepository = new JsonQuestionRepository();

interface CbtResult {
  sessionId: string;
  examId: string;
  title: string;
  solvedAt: number;
  correct: number;
  total: number;
  solved: number;
  passed: boolean;
  subjectScores: SubjectScore[];
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CbtCard({ result: r }: { result: CbtResult }) {
  // 이 회차를 응시했을 때 실제로 틀리거나(또는 안 푼) 문항 수 — 그 세션의 attempts로만
  // 계산되므로, 이후 오답노트에서 재도전해 맞히더라도 이 숫자는 절대 바뀌지 않는다.
  // 오답노트 상태(wrongNotes)에 의존하면 재도전 결과에 따라 계속 흔들리게 된다.
  const wrongCount = r.total - r.correct;
  return (
    <div className="p-4 rounded border flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="font-medium">{r.title}</span>
        <span className="text-xs text-gray-400">{formatDateTime(r.solvedAt)}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{Math.round((r.correct / r.total) * 100)}점</span>
        <span className={r.passed ? "text-green-700" : "text-red-700"}>
          {r.passed ? "합격" : "불합격"}
        </span>
        {r.solved < r.total && (
          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">미완료</span>
        )}
      </div>
      <ul className="text-sm text-gray-600 grid grid-cols-2 gap-x-4 gap-y-1">
        {r.subjectScores.map((s) => (
          <li key={s.subject}>
            {SUBJECT_NAMES[s.subject]}: {s.correct}/{s.total}
          </li>
        ))}
      </ul>
      {wrongCount > 0 && (
        <Link
          href={`/review?examId=${encodeURIComponent(r.examId)}&mode=exam`}
          className="self-start text-sm text-blue-700 underline"
        >
          오답 다시풀기 ({wrongCount}문제)
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [cbtResults, setCbtResults] = useState<CbtResult[] | null>(null);
  const [cbtError, setCbtError] = useState(false);
  const [showAllCbt, setShowAllCbt] = useState(false);

  useEffect(() => {
    progressRepository.getDashboardSummary().then(
      (result) => setSummary(result),
      (err) => {
        console.error("getDashboardSummary failed:", err);
        setError(true);
      }
    );

    Promise.all([questionRepository.getExamIndex(), progressRepository.getAttempts()])
      .then(async ([exams, attempts]) => {
        const sessions = listExamSessions(attempts);
        const results = await Promise.all(
          sessions.map(async ({ examId, sessionId, solvedAt }) => {
            try {
              const exam = exams.find((e) => e.examId === examId);
              if (!exam) return null;
              const questions = await questionRepository.getQuestions({ examId });
              const score = scoreExamSession(questions, attempts, examId, sessionId);
              return { sessionId, examId, title: exam.title, solvedAt, ...score };
            } catch (err) {
              // 세션 하나 계산이 실패해도(예: 회차 JSON fetch 실패) 나머지는 보여준다.
              console.error(`CBT 세션(${sessionId}) 계산 실패:`, err);
              return null;
            }
          })
        );
        setCbtResults(results.filter((r): r is CbtResult => r !== null));
      })
      .catch((err) => {
        console.error("CBT 결과 목록 계산 실패:", err);
        setCbtError(true);
      });
  }, []);

  if (error) {
    return (
      <p className="text-center p-10 text-red-700">
        학습 기록을 불러오지 못했다. 다시 시도해달라.
      </p>
    );
  }

  if (!summary) {
    return <p className="text-center p-10">불러오는 중...</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">대시보드</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded border flex flex-col gap-1">
          <span className="text-sm text-gray-500">오늘 풀이수</span>
          <span className="text-2xl font-bold">{summary.todayCount}</span>
        </div>
        <div className="p-4 rounded border flex flex-col gap-1">
          <span className="text-sm text-gray-500">오늘 정답률</span>
          <span className="text-2xl font-bold">{formatPercent(summary.todayAccuracy)}</span>
        </div>
        <div className="p-4 rounded border flex flex-col gap-1">
          <span className="text-sm text-gray-500">전체 풀이수</span>
          <span className="text-2xl font-bold">{summary.totalCount}</span>
        </div>
        <div className="p-4 rounded border flex flex-col gap-1">
          <span className="text-sm text-gray-500">전체 정답률</span>
          <span className="text-2xl font-bold">{formatPercent(summary.totalAccuracy)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">CBT 응시 기록</h2>
        {cbtError ? (
          <p className="text-sm text-red-700">CBT 응시 기록을 불러오지 못했다. 다시 시도해달라.</p>
        ) : cbtResults === null ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : cbtResults.length === 0 ? (
          <p className="text-sm text-gray-500">아직 시험모드로 회차 전체를 응시한 기록이 없다.</p>
        ) : (
          <>
            {cbtResults.slice(0, 3).map((r) => (
              <CbtCard key={r.sessionId} result={r} />
            ))}
            {cbtResults.length > 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAllCbt((prev) => !prev)}
                  className="self-start text-sm text-gray-500 underline"
                >
                  {showAllCbt ? "접기" : `이전 기록 더보기 (${cbtResults.length - 3}개)`}
                </button>
                {showAllCbt &&
                  cbtResults.slice(3).map((r) => <CbtCard key={r.sessionId} result={r} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
