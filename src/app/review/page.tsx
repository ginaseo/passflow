"use client";

import { useEffect, useRef, useState } from "react";
import { ReviewList } from "@/features/review/ReviewList";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { getRecentlySolvedQuestionIds } from "@/lib/recentlySolved";
import type { SessionSummary } from "@/lib/summary";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();
const progressRepository = new IndexedDbProgressRepository();

type Tab = "wrong" | "favorite" | "recent";

type Phase =
  | { kind: "list" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap }
  | { kind: "done"; summary: SessionSummary }
  | { kind: "error"; message: string };

const TAB_LABEL: Record<Tab, string> = {
  wrong: "오답노트",
  favorite: "즐겨찾기",
  recent: "최근 푼 문제",
};

const EMPTY_MESSAGE: Record<Tab, string> = {
  wrong: "오답노트가 비어있다.",
  favorite: "즐겨찾기한 문제가 없다.",
  recent: "최근 푼 문제가 없다.",
};

async function hydrate(questionIds: string[]): Promise<Question[]> {
  const results = await Promise.allSettled(
    questionIds.map((id) => questionRepository.getQuestion(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Question> => r.status === "fulfilled")
    .map((r) => r.value);
}

async function fetchTabQuestions(nextTab: Tab): Promise<Question[]> {
  let questionIds: string[];
  if (nextTab === "wrong") {
    questionIds = (await progressRepository.getWrongNotes()).map((n) => n.questionId);
  } else if (nextTab === "favorite") {
    questionIds = (await progressRepository.getFavorites()).map((n) => n.questionId);
  } else {
    const attempts = await progressRepository.getAttempts();
    questionIds = getRecentlySolvedQuestionIds(attempts, 20);
  }
  return hydrate(questionIds);
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("wrong");
  const [phase, setPhase] = useState<Phase>({ kind: "list" });
  const [questions, setQuestions] = useState<Question[]>([]);
  // `loadedTab` (rather than a `loading` boolean flipped via effect) lets `loading` be
  // derived during render instead of set synchronously inside useEffect, which
  // react-hooks/set-state-in-effect disallows even through an intermediate async call.
  const [loadedTab, setLoadedTab] = useState<Tab | null>(null);
  const latestRequestId = useRef(0);
  const loading = loadedTab !== tab;

  // Reusable for imperative reloads (e.g. the "복습 목록으로" button) — never referenced
  // from the effect below, since react-hooks/set-state-in-effect flags any effect that
  // captures a function which itself calls a state setter, however deep.
  function loadTab(nextTab: Tab) {
    const requestId = ++latestRequestId.current;
    fetchTabQuestions(nextTab).then(
      (hydrated) => {
        if (requestId !== latestRequestId.current) return;
        setQuestions(hydrated);
        setLoadedTab(nextTab);
      },
      (err) => {
        if (requestId !== latestRequestId.current) return;
        console.error("loadTab failed:", err);
        setQuestions([]);
        setLoadedTab(nextTab);
      }
    );
  }

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    fetchTabQuestions(tab).then(
      (hydrated) => {
        if (requestId !== latestRequestId.current) return;
        setQuestions(hydrated);
        setLoadedTab(tab);
      },
      (err) => {
        if (requestId !== latestRequestId.current) return;
        console.error("loadTab failed:", err);
        setQuestions([]);
        setLoadedTab(tab);
      }
    );
  }, [tab]);

  async function handleRemove(questionId: string) {
    if (tab === "wrong") {
      await progressRepository.removeWrongNote(questionId).catch((err) => console.error(err));
    } else if (tab === "favorite") {
      await progressRepository.removeFavorite(questionId).catch((err) => console.error(err));
    }
    setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  }

  async function handleRetryAll() {
    try {
      const theoryMap = await questionRepository.getTheoryMap();
      setPhase({ kind: "active", questions, theoryMap });
    } catch {
      setPhase({ kind: "error", message: "관련 이론 데이터를 불러오지 못했다. 다시 시도해달라." });
    }
  }

  if (phase.kind === "error") {
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium text-red-700">{phase.message}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "list" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          목록으로
        </button>
      </div>
    );
  }

  if (phase.kind === "done") {
    const { total, solved, correct, wrong } = phase.summary;
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">복습 완료.</p>
        <p className="text-gray-600">
          {total}문제 중 {solved}문제 풀이 — 정답 {correct} · 오답 {wrong}
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase({ kind: "list" });
            loadTab(tab);
          }}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          복습 목록으로
        </button>
      </div>
    );
  }

  if (phase.kind === "active") {
    return (
      <PracticeSession
        questions={phase.questions}
        theoryMap={phase.theoryMap}
        onFinish={(summary) => setPhase({ kind: "done", summary })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xl mx-auto w-full flex gap-2 px-6 pt-6">
        {(["wrong", "favorite", "recent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded border ${tab === t ? "bg-black text-white" : ""}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-center p-10">불러오는 중...</p>
      ) : (
        <ReviewList
          questions={questions}
          emptyMessage={EMPTY_MESSAGE[tab]}
          onRemove={tab === "recent" ? undefined : handleRemove}
          onRetryAll={handleRetryAll}
        />
      )}
    </div>
  );
}
