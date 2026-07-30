"use client";

import { useState } from "react";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { pickRandomQuestions } from "@/lib/sampling";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();

type Phase =
  | { kind: "setup" }
  | { kind: "loading" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap }
  | { kind: "done" }
  | { kind: "error"; message: string };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  async function start(value: PracticeSetupValue) {
    setPhase({ kind: "loading" });

    try {
      const [pool, theoryMap] = await Promise.all([
        questionRepository.getQuestions(
          value.subject === "all" ? {} : { subject: value.subject }
        ),
        fetch("/data/theory_map.json").then((res) => res.json() as Promise<TheoryMap>),
      ]);

      const questions = pickRandomQuestions(pool, value.count);
      if (questions.length === 0) {
        setPhase({ kind: "error", message: "문제를 찾을 수 없다. 다시 시도해달라." });
        return;
      }

      setPhase({ kind: "active", questions, theoryMap });
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
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">수고했다.</p>
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
      onFinish={() => setPhase({ kind: "done" })}
    />
  );
}
