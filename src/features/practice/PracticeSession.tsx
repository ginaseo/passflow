"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionCard } from "./QuestionCard";
import { gradeAnswer } from "@/lib/grading";
import { resolveTheoryLink } from "@/lib/theory";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

interface PracticeSessionProps {
  questions: Question[];
  theoryMap: TheoryMap;
  onFinish: () => void;
}

const progressRepository = new IndexedDbProgressRepository();

export function PracticeSession({ questions, theoryMap, onFinish }: PracticeSessionProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());

  const question = questions[current];
  const selectedAnswer = answers[current] ?? null;
  const theoryLink = useMemo(
    () => resolveTheoryLink(question, theoryMap),
    [question, theoryMap]
  );

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setCurrent(nextIndex);
    setQuestionStartedAt(Date.now());
  }

  function select(answer: number) {
    if (selectedAnswer !== null) return;
    setAnswers((prev) => ({ ...prev, [current]: answer }));

    const isCorrect = gradeAnswer(question, answer);
    void progressRepository.recordAttempt({
      questionId: question.questionId,
      solvedAt: Date.now(),
      mode: "study",
      selectedAnswer: answer,
      isCorrect,
      solveTimeMs: Date.now() - questionStartedAt,
    });
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["1", "2", "3", "4"].includes(e.key)) {
        select(Number(e.key));
      } else if (e.key === " ") {
        e.preventDefault();
        if (current === questions.length - 1) {
          onFinish();
        } else {
          goTo(current + 1);
        }
      } else if (e.key === "ArrowRight") {
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(current - 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col gap-4">
      <QuestionCard
        question={question}
        index={current}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        theoryLink={selectedAnswer !== null ? theoryLink : null}
        onSelect={select}
      />
      <div className="max-w-xl mx-auto w-full flex justify-between px-6 text-sm text-gray-500">
        <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0}>
          ← 이전
        </button>
        <span>Space: 다음 · 1~4: 답 선택</span>
        {current === questions.length - 1 ? (
          <button type="button" onClick={onFinish} className="text-blue-700 font-medium">
            종료
          </button>
        ) : (
          <button type="button" onClick={() => goTo(current + 1)}>
            다음 →
          </button>
        )}
      </div>
    </div>
  );
}
