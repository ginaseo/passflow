"use client";

import type { Question } from "@/types/question";
import type { TheoryLink } from "@/types/theory";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  selectedAnswer: number | null;
  theoryLink: TheoryLink | null;
  onSelect: (answer: number) => void;
}

export function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  theoryLink,
  onSelect,
}: QuestionCardProps) {
  const isGraded = selectedAnswer !== null;
  const isCorrect = isGraded && selectedAnswer === question.answer;

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="text-sm text-gray-500">
        {index + 1} / {total}
      </div>

      <p className="text-lg font-medium whitespace-pre-wrap">{question.stem}</p>

      {question.image && (
        <img src={`/data/${question.image}`} alt="문항 이미지" className="max-w-full rounded border" />
      )}

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const optionNumber = i + 1;
          const isSelected = selectedAnswer === optionNumber;
          const isAnswer = optionNumber === question.answer;

          let style = "border-gray-300";
          if (isGraded && isAnswer) style = "border-green-600 bg-green-50";
          else if (isGraded && isSelected && !isAnswer) style = "border-red-600 bg-red-50";
          else if (isSelected) style = "border-blue-600";

          return (
            <button
              key={optionNumber}
              type="button"
              disabled={isGraded}
              onClick={() => onSelect(optionNumber)}
              className={`text-left px-3 py-2 rounded border ${style}`}
            >
              {optionNumber}. {option}
            </button>
          );
        })}
      </div>

      {isGraded && (
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
