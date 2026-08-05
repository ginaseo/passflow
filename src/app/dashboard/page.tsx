"use client";

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
  title: string;
  solvedAt: number;
  correct: number;
  total: number;
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

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [cbtResults, setCbtResults] = useState<CbtResult[] | null>(null);

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
            const exam = exams.find((e) => e.examId === examId);
            if (!exam) return null;
            const questions = await questionRepository.getQuestions({ examId });
            const score = scoreExamSession(questions, attempts, examId, sessionId);
            return { sessionId, title: exam.title, solvedAt, ...score };
          })
        );
        setCbtResults(results.filter((r): r is CbtResult => r !== null));
      })
      .catch((err) => console.error("CBT 결과 목록 계산 실패:", err));
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
        {cbtResults === null ? (
          <p className="text-sm text-gray-500">불러오는 중...</p>
        ) : cbtResults.length === 0 ? (
          <p className="text-sm text-gray-500">아직 시험모드로 회차 전체를 응시한 기록이 없다.</p>
        ) : (
          cbtResults.map((r) => (
            <div key={r.sessionId} className="p-4 rounded border flex flex-col gap-2">
              <div className="flex justify-between items-baseline">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-gray-400">{formatDateTime(r.solvedAt)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {Math.round((r.correct / r.total) * 100)}점
                </span>
                <span className={r.passed ? "text-green-700" : "text-red-700"}>
                  {r.passed ? "합격" : "불합격"}
                </span>
              </div>
              <ul className="text-sm text-gray-600 grid grid-cols-2 gap-x-4 gap-y-1">
                {r.subjectScores.map((s) => (
                  <li key={s.subject}>
                    {SUBJECT_NAMES[s.subject]}: {s.correct}/{s.total}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
