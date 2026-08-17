"use client";

import type { PublicQuestion } from "@/types/question";

interface AnswerGridProps {
  questions: PublicQuestion[];
  mode: "progress" | "result";
  answers: Record<number, number>;
  correctByIndex?: Record<number, boolean>;
  currentIndex?: number;
  onJump?: (index: number) => void;
}

export function AnswerGrid({
  questions,
  mode,
  answers,
  correctByIndex,
  currentIndex,
  onJump,
}: AnswerGridProps) {
  return (
    <div className="max-w-xl mx-auto w-full grid grid-cols-10 gap-0.5 p-2">
      {questions.map((question, i) => {
        const answered = i in answers;
        const isCorrect = answered && correctByIndex?.[i] === true;
        const isCurrent = i === currentIndex;

        let style: string;
        if (mode === "progress") {
          style = answered
            ? "border-blue-600 bg-blue-50 text-blue-700"
            : "border-gray-300 text-gray-400";
        } else if (!answered) {
          style = "border-gray-300 bg-gray-50 text-gray-400";
        } else {
          style = isCorrect
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-red-600 bg-red-50 text-red-700";
        }
        if (isCurrent) style += " ring-2 ring-blue-400";

        return (
          <button
            key={question.questionId}
            type="button"
            onClick={onJump ? () => onJump(i) : undefined}
            disabled={!onJump}
            className={`min-h-6 min-w-6 text-[10px] py-0.5 rounded border ${style} ${onJump ? "cursor-pointer" : "cursor-default"}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
