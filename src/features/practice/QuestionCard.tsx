"use client";

import Image from "next/image";
import { getSubjectLabel } from "@/lib/theory";
import type { PublicQuestion, SelectedAnswer } from "@/types/question";
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
  selectedAnswer: SelectedAnswer | null;
  showFeedback: boolean;
  feedback: QuestionFeedback | null;
  theoryLink: TheoryLink | null;
  isFavorited: boolean;
  onSelect: (answer: number) => void;
  onFavorite: () => void;
}

function toSelectedList(value: SelectedAnswer | null): number[] {
  if (value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isCorrectOption(
    feedback: QuestionFeedback,
    optionNumber: number
): boolean {
  return Array.isArray(feedback.correctAnswer)
      ? feedback.correctAnswer.includes(optionNumber)
      : optionNumber === feedback.correctAnswer;
}

function imageSrc(image: string): string {
  if (image.startsWith("/api/media/")) return image;
  return `/api/media/${image}`;
}

const TABLE_HTML_CLASS =
    // 박스 안 표/이미지는 가운데 정렬한다 — 표(box-frame 바로 아래 table)는 mx-auto로,
    // 표 2개를 나란히 두는 flex wrapper(div)는 justify-center로 중앙에 모은다.
    // pre(SQL)는 코드라 왼쪽 정렬 유지.
    "overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-gray-300 [&_td]:border-gray-300 [&_th]:px-3 [&_td]:px-3 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left [&_td]:text-left [&_.box-frame]:border [&_.box-frame]:border-gray-400 [&_.box-frame]:rounded [&_.box-frame]:p-3 [&_.box-frame]:my-1 [&_.box-frame_table]:mb-3 [&_.box-frame>table]:mx-auto [&_.box-frame>div]:justify-center [&_.box-frame_pre]:whitespace-pre-wrap [&_.box-frame_pre]:text-sm";

function formatPlaceholderText(text: string): string {
  return text
  .replace(/(?<!\[)㉠(?!\])/g, "[㉠]")
  .replace(/(?<!\[)㉡(?!\])/g, "[㉡]")
  .replace(/(?<!\[)㉢(?!\])/g, "[㉢]")
  .replace(/(?<!\[)㉣(?!\])/g, "[㉣]")
  .replace(/(?<!\[)㉤(?!\])/g, "[㉤]")
  .replace(/&#x3260;?/gi, "[㉠]")
  .replace(/&#12896;/g, "[㉠]")
  .replace(/&#x3261;?/gi, "[㉡]")
  .replace(/&#12897;/g, "[㉡]");
}

function formatPlaceholderHtml(html: string): string {
  let placeholderIndex = 0;
  const placeholders = ["㉠", "㉡", "㉢", "㉣", "㉤"];

  let result = formatPlaceholderText(html);

  // 기출 데이터에서 빈칸으로 사용되는 빈 span을
  // [㉠], [㉡] 형태로 변환
  result = result.replace(
      /<span\b[^>]*>\s*(?:&nbsp;|\u00a0)\s*<\/span>/gi,
      () => {
        const label = placeholders[placeholderIndex] ?? "㉠";
        placeholderIndex += 1;
        return `[${label}]`;
      }
  );

  return result;
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
  const requiredCount = question.answerCount ?? 1;
  const isMultiSelect = requiredCount > 1;
  const selectedList = toSelectedList(selectedAnswer);
  const isImageInsideBox = Boolean(question.image) && Boolean(question.table?.startsWith('<div class="box-frame">'));
  // 표(결과 보기 옵션 포함)가 있는 문항은 PC에서 가로스크롤 없이 다 보이게 카드를
  // 넓힌다 — 모바일은 max-w-xl이 어차피 화면폭보다 커서 영향 없고, 표는 계속
  // overflow-x-auto로 가로스크롤된다. 문제 본문/보기 텍스트는 넓어진 카드 안에서도
  // 다시 max-w-xl로 좁혀 가독성을 유지한다.
  const hasWideContent = Boolean(question.table) || question.options.some((o) => o.includes("<table"));
  const cardWidthClass = hasWideContent ? "max-w-xl sm:max-w-3xl lg:max-w-5xl" : "max-w-xl";

  return (
      <div className={`${cardWidthClass} mx-auto p-6 flex flex-col gap-4 w-full`}>
        <div className="max-w-xl mx-auto w-full flex items-center justify-between text-sm text-gray-500">
        <span>
          {index + 1} / {total} / {question.qnum} / {getSubjectLabel(question)}
          {question.verified === false && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs align-middle">
              {"\uC7AC\uAD6C\uC131 \uBB38\uD56D - \uC2E4\uC81C \uAE30\uCD9C\uACFC \uB2E4\uB97C \uC218 \uC788\uC74C"}
            </span>
          )}
        </span>

          <button
              type="button"
              onClick={onFavorite}
              className="text-yellow-600"
          >
            {isFavorited
                ? "\uC990\uACA8\uCC3E\uAE30 \uC644\uB8CC"
                : "\uC990\uACA8\uCC3E\uAE30"}
          </button>
        </div>

        <p className="max-w-xl mx-auto w-full text-lg font-medium whitespace-pre-wrap">
          {formatPlaceholderText(question.stem)}
        </p>

        {question.image && !isImageInsideBox && (
            <div className="relative mx-auto h-[320px] w-full max-w-xl">
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

        {question.table && !isImageInsideBox && (
            <div className={TABLE_HTML_CLASS} dangerouslySetInnerHTML={{ __html: formatPlaceholderHtml(question.table) }} />
        )}

        {/* PDF \uC6D0\uBCF8\uC740 \uB370\uC774\uD130 \uBAA8\uB378 \uC774\uBBF8\uC9C0\uC640 \uADF8 \uC544\uB798 \uC124\uBA85/SQL/\uD45C\uAC00 \uD558\uB098\uC758 \uB124\uBAA8\uCE78 \uC548\uC5D0
            \uC774\uC5B4\uC9C0\uB294 \uAD6C\uC870\uB2E4 \u2014 image\uC640 box-frame table\uC774 \uB458 \uB2E4 \uC788\uC73C\uBA74, Next Image\uB294
            dangerouslySetInnerHTML \uBB38\uC790\uC5F4 \uC548\uC5D0 \uBABB \uB123\uC73C\uB2C8 JSX \uB808\uBCA8\uC5D0\uC11C \uACF5\uD1B5 \uD14C\uB450\uB9AC
            \uD558\uB098\uB85C \uAC10\uC2F8\uACE0 \uAC01\uC790\uC758 \uAC1C\uBCC4 \uD14C\uB450\uB9AC\uB294 \uC5C6\uC560 \uC774\uC911 \uBC15\uC2A4\uAC00 \uC0DD\uAE30\uC9C0 \uC54A\uAC8C \uD55C\uB2E4. */}
        {question.image && isImageInsideBox && (
            <div className="border border-gray-400 rounded p-3 flex flex-col gap-3">
              {/* fill+\uACE0\uC815 h-[320px]\uB294 \uAC00\uB85C\uB85C \uB113\uACE0 \uC138\uB85C\uB85C \uC9E7\uC740 \uC774\uBBF8\uC9C0(\uC608: sqld2-q97, 4:1 \uBE44\uC728)\uB97C
                  object-contain\uC73C\uB85C \uCC44\uC6B0\uBA74\uC11C \uC704\uC544\uB798\uB85C \uD070 \uB808\uD130\uBC15\uC2A4 \uC5EC\uBC31\uC744 \uB0A8\uACA8 \uD45C/SQL\uACFC \uAC04\uACA9\uC774
                  \uBC8C\uC5B4\uC838 \uBCF4\uC778\uB2E4 \u2014 width/height+CSS auto-height\uB85C \uC2E4\uC81C \uBE44\uC728\uB300\uB85C \uB80C\uB354\uB9C1\uD574 \uC5EC\uBC31\uC744 \uC5C6\uC564\uB2E4. */}
              <div className="relative mx-auto w-full max-w-xl">
                <Image
                    src={imageSrc(question.image)}
                    alt="\uBB38\uD56D \uC774\uBBF8\uC9C0"
                    width={800}
                    height={400}
                    sizes="(max-width: 768px) 100vw, 640px"
                    className="rounded object-contain w-full h-auto"
                    unoptimized
                />
              </div>
              {question.table && (
                  <div
                      className={`${TABLE_HTML_CLASS} [&_.box-frame]:border-0 [&_.box-frame]:rounded-none [&_.box-frame]:p-0 [&_.box-frame]:my-0`}
                      dangerouslySetInnerHTML={{ __html: formatPlaceholderHtml(question.table) }}
                  />
              )}
            </div>
        )}

        {isMultiSelect && !showFeedback && (
            <p className="text-sm text-gray-500">
              정답을 {requiredCount}개 선택하세요 ({selectedList.length}/{requiredCount})
            </p>
        )}

        <div className="flex flex-col gap-2">
          {question.options.map((option, i) => {
            const optionNumber = i + 1;
            const isSelected = selectedList.includes(optionNumber);
            const isAnswer =
                showFeedback &&
                feedback !== null &&
                isCorrectOption(feedback, optionNumber);

            let style = "border-gray-300";

            if (showFeedback && isAnswer) {
              style = "border-green-600 bg-green-50";
            } else if (showFeedback && isSelected && !isAnswer) {
              style = "border-red-600 bg-red-50";
            } else if (isSelected) {
              style = "border-blue-600";
            }

            const hasTable = option.includes("<table");
            const disabled =
                showFeedback || (isMultiSelect && !isSelected && selectedList.length >= requiredCount);

            return (
                <button
                    key={optionNumber}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(optionNumber)}
                    className={`text-left px-3 py-2 rounded border ${
                        hasTable ? "" : "whitespace-pre-wrap"
                    } ${style}`}
                >
                  {hasTable ? (
                      <>
                        <span>{optionNumber}.</span>

                        <div
                            className="mt-1 overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-gray-300 [&_td]:border-gray-300 [&_th]:px-3 [&_td]:px-3 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_th]:text-left [&_td]:text-left"
                            dangerouslySetInnerHTML={{
                              __html: formatPlaceholderHtml(option),
                            }}
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
              <p
                  className={
                    isCorrect
                        ? "text-green-700 font-medium"
                        : "text-red-700 font-medium"
                  }
              >
                {isCorrect ? "\uC815\uB2F5" : "\uC624\uB2F5"}
              </p>

              <p className="text-sm whitespace-pre-wrap">
                {formatPlaceholderText(feedback.explanation)}
              </p>

              {theoryLink && (
                  <p className="text-sm text-blue-700">
                    {"\uAD00\uB828 \uC774\uB860"}: {theoryLink.label} (p.
                    {theoryLink.page})
                  </p>
              )}
            </div>
        )}
      </div>
  );
}
