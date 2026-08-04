"use client";

import { useState } from "react";
import type { Question } from "@/types/question";

interface ReviewListProps {
  questions: Question[];
  emptyMessage: string;
  onRemove?: (questionId: string) => void;
  onRetry: (questions: Question[]) => void;
  metaFor?: (questionId: string) => string | null;
}

export function ReviewList({ questions, emptyMessage, onRemove, onRetry, metaFor }: ReviewListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (questions.length === 0) {
    return <p className="text-center text-gray-500 p-10">{emptyMessage}</p>;
  }

  function toggleSelected(questionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  const selectedQuestions = questions.filter((q) => selected.has(q.questionId));

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onRetry(questions)}
          className="px-4 py-2 rounded bg-blue-600 text-white font-medium"
        >
          전체 다시 풀기 ({questions.length}문제)
        </button>
        <button
          type="button"
          onClick={() => onRetry(selectedQuestions)}
          disabled={selectedQuestions.length === 0}
          className="px-4 py-2 rounded border font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          선택 다시 풀기 ({selectedQuestions.length}문제)
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li key={question.questionId} className="flex items-center gap-3 p-3 rounded border">
            <input
              type="checkbox"
              checked={selected.has(question.questionId)}
              onChange={() => toggleSelected(question.questionId)}
              aria-label={`${question.stem} 선택`}
            />
            <span
              onClick={() => toggleSelected(question.questionId)}
              className="text-sm flex-1 cursor-pointer"
            >
              <span className="block truncate">{question.stem}</span>
              {metaFor?.(question.questionId) && (
                <span className="block text-xs text-gray-400">{metaFor(question.questionId)}</span>
              )}
            </span>
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
