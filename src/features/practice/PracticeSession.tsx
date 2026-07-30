"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionCard } from "./QuestionCard";
import { gradeAnswer } from "@/lib/grading";
import { resolveTheoryLink } from "@/lib/theory";
import { summarizeSession, type SessionSummary } from "@/lib/summary";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

interface PracticeSessionProps {
  questions: Question[];
  theoryMap: TheoryMap;
  onFinish: (summary: SessionSummary) => void;
}

const progressRepository = new IndexedDbProgressRepository();

export function PracticeSession({ questions, theoryMap, onFinish }: PracticeSessionProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [favorited, setFavorited] = useState<Record<number, boolean>>({});
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
    progressRepository
      .recordAttempt({
        questionId: question.questionId,
        solvedAt: Date.now(),
        mode: "study",
        selectedAnswer: answer,
        isCorrect,
        solveTimeMs: Date.now() - questionStartedAt,
      })
      .catch((err) => console.error("recordAttempt failed:", err));

    if (!isCorrect) {
      progressRepository
        .addWrongNote(question.questionId)
        .catch((err) => console.error("addWrongNote failed:", err));
    }
  }

  function toggleFavorite() {
    if (favorited[current]) return;
    setFavorited((prev) => ({ ...prev, [current]: true }));
    progressRepository
      .addFavorite(question.questionId)
      .catch((err) => console.error("addFavorite failed:", err));
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        select(Number(e.key));
      } else if (e.key === " ") {
        e.preventDefault();
        if (current === questions.length - 1) {
          onFinish(summarizeSession(questions, answers));
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
      <div className="max-w-xl mx-auto w-full flex justify-end px-6">
        <button
          type="button"
          onClick={() => onFinish(summarizeSession(questions, answers))}
          className="text-sm text-gray-500 underline"
        >
          그만두기
        </button>
      </div>
      <QuestionCard
        question={question}
        index={current}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        theoryLink={selectedAnswer !== null ? theoryLink : null}
        isFavorited={favorited[current] ?? false}
        onSelect={select}
        onFavorite={toggleFavorite}
      />
      <div className="max-w-xl mx-auto w-full flex justify-between px-6 text-sm text-gray-500">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 이전
        </button>
        <span>Space: 다음 · 1~4: 답 선택</span>
        {current === questions.length - 1 ? (
          <button
            type="button"
            onClick={() => onFinish(summarizeSession(questions, answers))}
            className="text-blue-700 font-medium"
          >
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
