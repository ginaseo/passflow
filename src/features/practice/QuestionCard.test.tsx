import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "./QuestionCard";
import type { Question } from "@/types/question";

const BADGE_TEXT = "재구성 문항 — 실제 기출과 다를 수 있음";

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    questionId: "2023-1-Q1",
    examId: "2023-1",
    qnum: 1,
    stem: "질문 내용입니다",
    options: ["보기1", "보기2", "보기3", "보기4"],
    subject: 1,
    subjectName: "소프트웨어 설계",
    answer: 1,
    explanation: "해설입니다",
    image: null,
    ...overrides,
  };
}

function renderCard(question: Question) {
  return renderToStaticMarkup(
    <QuestionCard
      question={question}
      index={0}
      total={10}
      selectedAnswer={null}
      showFeedback={false}
      theoryLink={null}
      isFavorited={false}
      onSelect={vi.fn()}
      onFavorite={vi.fn()}
    />
  );
}

describe("QuestionCard", () => {
  it("verified가 false면 재구성 문항 배지를 보여준다", () => {
    const html = renderCard(baseQuestion({ verified: false }));
    expect(html).toContain(BADGE_TEXT);
  });

  it("verified가 true면 배지를 보여주지 않는다", () => {
    const html = renderCard(baseQuestion({ verified: true }));
    expect(html).not.toContain(BADGE_TEXT);
  });

  it("verified가 지정되지 않으면(대부분의 경우) 배지를 보여주지 않는다", () => {
    const html = renderCard(baseQuestion());
    expect(html).not.toContain(BADGE_TEXT);
  });

  it("문항 번호·전체 개수·과목명은 verified 여부와 무관하게 항상 표시된다", () => {
    const html = renderCard(baseQuestion({ verified: false }));
    expect(html).toContain("1 / 10");
    expect(html).toContain("1과목 소프트웨어 설계");
  });
});