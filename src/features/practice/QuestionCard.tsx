"use client";

import Image from "next/image";
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

function formatPlaceholderText(text: string): string {
  return text.replace(/(?<!\[)㉠(?!\])/g, "[㉠]").replace(/(?<!\[)㉡(?!\])/g, "[㉡]");
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
          {index + 1} / {total} / {question.qnum} / {getSubjectLabel(question)}
          {question.verified === false && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs align-middle">
              {"\uC7AC\uAD6C\uC131 \uBB38\uD56D - \uC2E4\uC81C \uAE30\uCD9C\uACFC \uB2E4\uB97C \uC218 \uC788\uC74C"}
            </span>
          )}
        </span>
          <button type="button" onClick={onFavorite} className="text-yellow-600">
            {isFavorited ? "\uC990\uACA8\uCC3E\uAE30 \uC644\uB8CC" : "\uC990\uACA8\uCC3E\uAE30"}
          </button>
        </div>

        <p className="text-lg font-medium whitespace-pre-wrap">
          {formatPlaceholderText(question.stem)}
        </p>

        {question.image && (
            <div className="relative mx-auto h-[320px] w-full max-w-full">
              <Image
                  src={imageSrc(question.image)}
                  alt="\uBB38\uD56D \uC774\uBBF8\uC9C0"
                  fill
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="rounded border object-contain"
                  unoptimized
              />
            </div>
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
            const isAnswer =
                showFeedback &&
                feedback !== null &&
                isCorrectOption(feedback, optionNumber);

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
                      `${optionNumber}. ${formatPlaceholderText(option)}`
                  )}
                </button>
            );
          })}
        </div>

        {showFeedback && feedback && (
            <div className="flex flex-col gap-2 mt-2 p-3 rounded bg-gray-50">
              <p className={isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                {isCorrect ? "\uC815\uB2F5" : "\uC624\uB2F5"}
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {formatPlaceholderText(feedback.explanation)}
              </p>
              {theoryLink && (
                  <p className="text-sm text-blue-700">
                    {"\uAD00\uB828 \uC774\uB860"}: {theoryLink.label} (p.{theoryLink.page})
                  </p>
              )}
            </div>
        )}
      </div>
  );
}
