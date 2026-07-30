"use client";

import { useState } from "react";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { pickRandomQuestions } from "@/lib/sampling";
import type { SessionSummary } from "@/lib/summary";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import type { Mode } from "@/types/progress";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();

type Phase =
  | { kind: "setup" }
  | { kind: "loading" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap; mode: Mode; timeLimitMs: number | null }
  | { kind: "done"; summary: SessionSummary }
  | { kind: "error"; message: string };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  async function start(value: PracticeSetupValue) {
    setPhase({ kind: "loading" });

    try {
      const theoryMapPromise = questionRepository.getTheoryMap();
      let questions: Question[];

      if (value.entryType === "round") {
        const pool = await questionRepository.getQuestions({ examId: value.examId });
        questions = [...pool].sort((a, b) => a.qnum - b.qnum);
      } else {
        const pool = await questionRepository.getQuestions(
          value.subject === "all" ? {} : { subject: value.subject }
        );
        questions = pickRandomQuestions(pool, value.count);
      }

      const theoryMap = await theoryMapPromise;

      if (questions.length === 0) {
        setPhase({ kind: "error", message: "문제를 찾을 수 없다. 다시 시도해달라." });
        return;
      }

      setPhase({
        kind: "active",
        questions,
        theoryMap,
        mode: value.mode,
        timeLimitMs: value.timeLimitMs,
      });
    } catch {
      setPhase({ kind: "error", message: "문제를 불러오지 못했다. 다시 시도해달라." });
    }
  }

  if (phase.kind === "setup") {
    return <PracticeSetup onStart={start} />;
  }

  if (phase.kind === "loading") {
    return <p className="text-center p-10">문제 불러오는 중...</p>;
  }

  if (phase.kind === "error") {
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium text-red-700">{phase.message}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "setup" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (phase.kind === "done") {
    const { total, solved, correct, wrong } = phase.summary;
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">수고했다.</p>
        <p className="text-gray-600">
          {total}문제 중 {solved}문제 풀이 — 정답 {correct} · 오답 {wrong}
        </p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "setup" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          다시 풀기
        </button>
      </div>
    );
  }

  return (
    <PracticeSession
      questions={phase.questions}
      theoryMap={phase.theoryMap}
      mode={phase.mode}
      timeLimitMs={phase.timeLimitMs}
      onFinish={(summary) => setPhase({ kind: "done", summary })}
    />
  );
}
