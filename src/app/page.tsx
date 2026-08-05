"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { pickResumeExamId } from "@/lib/resumeExam";
import type { DashboardSummary } from "@/types/progress";

const progressRepository = new IndexedDbProgressRepository();
const questionRepository = new JsonQuestionRepository();

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default function HomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);
  const [resumeExam, setResumeExam] = useState<{ examId: string; title: string } | null>(null);

  useEffect(() => {
    progressRepository.getDashboardSummary().then(
      (result) => setSummary(result),
      (err) => {
        console.error("getDashboardSummary failed:", err);
        setError(true);
      }
    );

    Promise.all([questionRepository.getExamIndex(), progressRepository.getAttempts()])
      .then(([exams, attempts]) => {
        const resumeExamId = pickResumeExamId(exams, attempts);
        const resumeExamEntry = resumeExamId ? exams.find((e) => e.examId === resumeExamId) : undefined;
        setResumeExam(resumeExamId && resumeExamEntry ? { examId: resumeExamId, title: resumeExamEntry.title } : null);
      })
      .catch((err) => console.error("이어서풀기 대상 계산 실패:", err));
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
      </div>

      <div className="flex flex-col gap-2">
        {resumeExam && (
          <Link
            href={`/practice?resume=${encodeURIComponent(resumeExam.examId)}`}
            className="px-4 py-3 rounded bg-blue-600 text-white font-medium text-center"
          >
            이어서 풀기 — {resumeExam.title}
          </Link>
        )}
        <Link
          href="/practice?mode=study&entry=random&subject=all&count=100"
          className="px-4 py-2 rounded border font-medium text-center"
        >
          학습모드
        </Link>
        <Link
          href="/practice?mode=exam&entry=round&limit=150"
          className="px-4 py-2 rounded border font-medium text-center"
        >
          시험모드
        </Link>
      </div>
    </div>
  );
}
