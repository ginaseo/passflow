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
  // sqld는 문제번호·지문만 박스 밖에 두고 이미지/표/SQL/보기를 전부 하나의
  // 콘텐츠 박스 안에 통합한다(작업계획서 요청). jcg는 기존 레이아웃(이미지·표·
  // 보기가 각각 별도 영역)을 그대로 유지한다 — questionId 접두사로 구분한다
  // (jcg는 접두사가 없다, @/lib/questionId 참고).
  const isSqld = question.questionId.startsWith("sqld:");
  // 실제 <table> 태그가 있는 문항만 PC에서 가로스크롤 없이 다 보이게 카드를
  // 넓힌다 — question.table 필드가 있어도 짧은 텍스트/SQL뿐이면(예: 1_25) 넓힐
  // 이유가 없다(그러면 같은 박스 레이아웃인 이미지뿐인 문항과 폭이 달라져
  // 어색해 보인다). 모바일은 max-w-xl이 어차피 화면폭보다 커서 영향 없고, 표는
  // 계속 overflow-x-auto로 가로스크롤된다. 문제 본문/보기 텍스트는 넓어진 카드
  // 안에서도 다시 max-w-xl로 좁혀 가독성을 유지한다.
  const hasWideContent =
      Boolean(question.table?.includes("<table")) || question.options.some((o) => o.includes("<table"));
  const cardWidthClass = hasWideContent ? "max-w-xl sm:max-w-3xl lg:max-w-5xl" : "max-w-xl";

  const multiSelectHint = isMultiSelect && !showFeedback && (
      <p className="text-sm text-gray-500">
        정답을 {requiredCount}개 선택하세요 ({selectedList.length}/{requiredCount})
      </p>
  );

  const optionsBlock = (
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
                  className={`text-left px-3 py-2 rounded border bg-white ${
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
  );

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

        {isSqld ? (
            <>
              {/* sqld: 문제번호·지문·보기(①②③④)는 박스 밖 그대로 두고, 이미지/표/SQL
                  같은 "문제가 제시하는 자료"만 있으면 하나의 박스로 합친다. 자료가
                  아예 없는 순수 텍스트 문항은 박스 자체를 안 만든다. */}
              {(question.image || question.table) && (
                  <div className="border border-gray-400 rounded p-3 flex flex-col gap-3">
                    {question.image && (
                        <div className="relative mx-auto w-full max-w-xl">
                          <Image
                              src={imageSrc(question.image)}
                              alt="문항 이미지"
                              width={800}
                              height={400}
                              sizes="(max-width: 768px) 100vw, 640px"
                              className="rounded object-contain w-full h-auto"
                              unoptimized
                          />
                        </div>
                    )}
                    {question.table && (
                        <div
                            className={`${TABLE_HTML_CLASS} [&_.box-frame]:border-0 [&_.box-frame]:rounded-none [&_.box-frame]:p-0 [&_.box-frame]:my-0`}
                            dangerouslySetInnerHTML={{ __html: formatPlaceholderHtml(question.table) }}
                        />
                    )}
                  </div>
              )}
              {multiSelectHint}
              {optionsBlock}
            </>
        ) : (
            <>
              {question.image && !isImageInsideBox && (
                  <div className="relative mx-auto h-[320px] w-full max-w-xl">
                    <Image
                        src={imageSrc(question.image)}
                        alt="문항 이미지"
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

              {question.image && isImageInsideBox && (
                  <div className="border border-gray-400 rounded p-3 flex flex-col gap-3">
                    <div className="relative mx-auto w-full max-w-xl">
                      <Image
                          src={imageSrc(question.image)}
                          alt="문항 이미지"
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

              {multiSelectHint}
              {optionsBlock}
            </>
        )}

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
