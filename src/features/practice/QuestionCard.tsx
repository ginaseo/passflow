"use client";

import { isCorrectOption } from "@/lib/grading";
import type { Question } from "@/types/question";
import type { TheoryLink } from "@/types/theory";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  selectedAnswer: number | null;
  showFeedback: boolean;
  theoryLink: TheoryLink | null;
  isFavorited: boolean;
  onSelect: (answer: number) => void;
  onFavorite: () => void;
}

export function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  showFeedback,
  theoryLink,
  isFavorited,
  onSelect,
  onFavorite,
}: QuestionCardProps) {
  const isCorrect =
    showFeedback && selectedAnswer !== null && isCorrectOption(question, selectedAnswer);

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {index + 1} / {total}
        </span>
        <button type="button" onClick={onFavorite} className="text-yellow-600">
          {isFavorited ? "★ 즐겨찾기 완료" : "☆ 즐겨찾기"}
        </button>
      </div>

      <p className="text-lg font-medium whitespace-pre-wrap">{question.stem}</p>

      {question.image && (
        <img src={`/data/${question.image}`} alt="문항 이미지" className="max-w-full rounded border" />
      )}

      {question.table && (
        <div
          className="overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-gray-300 [&_td]:border-gray-300 [&_th]:px-3 [&_td]:px-3 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left [&_td]:text-left"
          dangerouslySetInnerHTML={{ __html: question.table }}
        />
      )}

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const optionNumber = i + 1;
          const isSelected = selectedAnswer === optionNumber;
          const isAnswer = isCorrectOption(question, optionNumber);

          let style = "border-gray-300";
          if (showFeedback && isAnswer) style = "border-green-600 bg-green-50";
          else if (showFeedback && isSelected && !isAnswer) style = "border-red-600 bg-red-50";
          else if (isSelected) style = "border-blue-600";

          return (
            <button
              key={optionNumber}
              type="button"
              disabled={showFeedback}
              onClick={() => onSelect(optionNumber)}
              className={`text-left px-3 py-2 rounded border ${style}`}
            >
              {optionNumber}. {option}
            </button>
          );
        })}
      </div>

      {showFeedback && (
        <div className="flex flex-col gap-2 mt-2 p-3 rounded bg-gray-50">
          <p className={isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
            {isCorrect ? "정답" : "오답"}
          </p>
          <p className="text-sm whitespace-pre-wrap">{question.explanation}</p>
          {theoryLink && (
            <p className="text-sm text-blue-700">
              관련 이론: {theoryLink.label} (p.{theoryLink.page})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
