"use client";

import { getSubjectLabel } from "@/lib/theory";
import type { PublicQuestion } from "@/types/question";
import type { TheoryLink } from "@/types/theory";

export interface QuestionFeedback {
  correct: boolean;
  explanation: string;
  correctAnswer: number | number[];
}

interface QuestionCardProps {
  question: PublicQuestion;
  index: number;
  total: number;
  selectedAnswer: number | null;
  showFeedback: boolean;
  feedback: QuestionFeedback | null;
  theoryLink: TheoryLink | null;
  isFavorited: boolean;
  onSelect: (answer: number) => void;
  onFavorite: () => void;
}

function isCorrectOption(feedback: QuestionFeedback, optionNumber: number): boolean {
  return Array.isArray(feedback.correctAnswer)
    ? feedback.correctAnswer.includes(optionNumber)
    : optionNumber === feedback.correctAnswer;
}

function imageSrc(image: string): string {
  if (image.startsWith("/api/media/")) return image;
  return `/api/media/${image}`;
}

export function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  showFeedback,
  feedback,
  theoryLink,
  isFavorited,
  onSelect,
  onFavorite,
}: QuestionCardProps) {
  const isCorrect = showFeedback && feedback !== null && feedback.correct;

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {index + 1} / {total} · 원본 {question.qnum}번 · {getSubjectLabel(question)}
          {question.verified === false && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs align-middle">
              재구성 문항 - 실제 기출과 다를 수 있음.
            </span>
          )}
        </span>
        <button type="button" onClick={onFavorite} className="text-yellow-600">
          {isFavorited ? "★ 즐겨찾기 완료" : "☆ 즐겨찾기"}
        </button>
      </div>

      <p className="text-lg font-medium whitespace-pre-wrap">{question.stem}</p>

      {question.image && (
        <img
          src={imageSrc(question.image)}
          alt="문항 이미지"
          className="max-w-full max-h-[420px] w-auto object-contain rounded border mx-auto"
        />
      )}

      {question.table && (
        <div
          className="overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-gray-300 [&_td]:border-gray-300 [&_th]:px-3 [&_td]:px-3 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left [&_td]:text-left [&_.box-frame]:border [&_.box-frame]:border-gray-400 [&_.box-frame]:rounded [&_.box-frame]:p-3 [&_.box-frame]:my-1 [&_.box-frame_table]:mb-3 [&_.box-frame_pre]:whitespace-pre-wrap [&_.box-frame_pre]:text-sm"
          dangerouslySetInnerHTML={{ __html: question.table }}
        />
      )}

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const optionNumber = i + 1;
          const isSelected = selectedAnswer === optionNumber;
          const isAnswer = showFeedback && feedback !== null && isCorrectOption(feedback, optionNumber);

          let style = "border-gray-300";
          if (showFeedback && isAnswer) style = "border-green-600 bg-green-50";
          else if (showFeedback && isSelected && !isAnswer) style = "border-red-600 bg-red-50";
          else if (isSelected) style = "border-blue-600";

          const hasTable = option.includes("<table");

          return (
            <button
              key={optionNumber}
              type="button"
              disabled={showFeedback}
              onClick={() => onSelect(optionNumber)}
              className={`text-left px-3 py-2 rounded border ${hasTable ? "" : "whitespace-pre-wrap"} ${style}`}
            >
              {hasTable ? (
                <>
                  <span>{optionNumber}.</span>
                  <div
                    className="mt-1 overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-gray-300 [&_td]:border-gray-300 [&_th]:px-3 [&_td]:px-3 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left [&_td]:text-left"
                    dangerouslySetInnerHTML={{ __html: option }}
                  />
                </>
              ) : (
                `${optionNumber}. ${option}`
              )}
            </button>
          );
        })}
      </div>

      {showFeedback && feedback && (
        <div className="flex flex-col gap-2 mt-2 p-3 rounded bg-gray-50">
          <p className={isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
            {isCorrect ? "정답" : "오답"}
          </p>
          <p className="text-sm whitespace-pre-wrap">{feedback.explanation}</p>
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
