"use client";

import type { Question } from "@/types/question";

interface ReviewListProps {
  questions: Question[];
  emptyMessage: string;
  onRemove?: (questionId: string) => void;
  onRetryAll: () => void;
}

export function ReviewList({ questions, emptyMessage, onRemove, onRetryAll }: ReviewListProps) {
  if (questions.length === 0) {
    return <p className="text-center text-gray-500 p-10">{emptyMessage}</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <button
        type="button"
        onClick={onRetryAll}
        className="self-start px-4 py-2 rounded bg-blue-600 text-white font-medium"
      >
        전체 다시 풀기 ({questions.length}문제)
      </button>
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li
            key={question.questionId}
            className="flex items-center justify-between gap-3 p-3 rounded border"
          >
            <span className="text-sm truncate">{question.stem}</span>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(question.questionId)}
                className="text-sm text-gray-500 shrink-0"
              >
                제거
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
