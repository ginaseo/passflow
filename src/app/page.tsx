"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { pickLatestCompletedExamId, scoreExamFromAttempts } from "@/lib/latestExamResult";
import { pickResumeExamId } from "@/lib/resumeExam";
import type { DashboardSummary } from "@/types/progress";

const progressRepository = new IndexedDbProgressRepository();
const questionRepository = new JsonQuestionRepository();

interface LatestExam {
  title: string;
  correct: number;
  total: number;
  passed: boolean;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default function HomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [latestExam, setLatestExam] = useState<LatestExam | null>(null);
  const [resumeExamId, setResumeExamId] = useState<string | null>(null);

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
        setResumeExamId(pickResumeExamId(exams, attempts));

        const latestExamId = pickLatestCompletedExamId(exams, attempts);
        if (!latestExamId) return;
        const exam = exams.find((e) => e.examId === latestExamId);
        if (!exam) return;

        const questions = await questionRepository.getQuestions({ examId: latestExamId });
        const score = scoreExamFromAttempts(questions, attempts, latestExamId);
        if (!score) return;
        setLatestExam({ title: exam.title, ...score });
      })
      .catch((err) => console.error("최근 CBT 결과 계산 실패:", err));
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
      <h1 className="text-xl font-bold">PassFlow</h1>

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

      {latestExam && (
        <div className="p-4 rounded border flex flex-col gap-1">
          <span className="text-sm text-gray-500">최근 CBT — {latestExam.title}</span>
          <span className="text-2xl font-bold">
            {Math.round((latestExam.correct / latestExam.total) * 100)}점
          </span>
          <span className={latestExam.passed ? "text-green-700" : "text-red-700"}>
            {latestExam.passed ? "합격" : "불합격"}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {resumeExamId && (
          <Link
            href={`/practice?resume=${resumeExamId}`}
            className="px-4 py-3 rounded bg-blue-600 text-white font-medium text-center"
          >
            이어서 풀기
          </Link>
        )}
        <Link
          href="/practice"
          className="px-4 py-2 rounded border font-medium text-center"
        >
          랜덤 시작
        </Link>
        <Link
          href="/practice?entry=round"
          className="px-4 py-2 rounded border font-medium text-center"
        >
          회차별 시작
        </Link>
      </div>
    </div>
  );
}
