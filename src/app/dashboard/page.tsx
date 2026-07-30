"use client";

import { useEffect, useState } from "react";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { DashboardSummary } from "@/types/progress";

const progressRepository = new IndexedDbProgressRepository();

const EMPTY_SUMMARY: DashboardSummary = {
  todayCount: 0,
  todayAccuracy: 0,
  totalCount: 0,
  totalAccuracy: 0,
};

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    progressRepository.getDashboardSummary().then(
      (result) => setSummary(result),
      (err) => {
        console.error("getDashboardSummary failed:", err);
        setSummary(EMPTY_SUMMARY);
      }
    );
  }, []);

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
    </div>
  );
}
