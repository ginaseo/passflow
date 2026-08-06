"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerGrid } from "./AnswerGrid";
import { QuestionCard } from "./QuestionCard";
import { gradeAnswer } from "@/lib/grading";
import { resolveTheoryLink } from "@/lib/theory";
import { summarizeSession, type SessionSummary } from "@/lib/summary";
import { formatDuration, remainingMs } from "@/lib/timer";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { EntryType, Mode } from "@/types/progress";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

interface PracticeSessionProps {
  questions: Question[];
  theoryMap: TheoryMap;
  mode: Mode;
  entryType: EntryType;
  timeLimitMs: number | null;
  autoSaveWrongNotes: boolean;
  onFinish: (summary: SessionSummary) => void;
  initialAnswers?: Record<number, number>;
  initialSessionId?: string;
  initialSessionStartedAt?: number;
}

const progressRepository = new IndexedDbProgressRepository();

export function PracticeSession({
  questions,
  theoryMap,
  mode,
  entryType,
  timeLimitMs,
  autoSaveWrongNotes,
  onFinish,
  initialAnswers,
  initialSessionId,
  initialSessionStartedAt,
}: PracticeSessionProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>(() => initialAnswers ?? {});
  const [favorited, setFavorited] = useState<Record<number, boolean>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sessionStartedAt] = useState(() => initialSessionStartedAt ?? Date.now());
  const [sessionId] = useState(() => initialSessionId ?? `session-${crypto.randomUUID()}`);
  const finishedRef = useRef(false);
  const [showGrid, setShowGrid] = useState(false);

  const question = questions[current];
  const selectedAnswer = answers[current] ?? null;
  const theoryLink = useMemo(
    () => resolveTheoryLink(question, theoryMap),
    [question, theoryMap]
  );
  const showFeedback = mode === "study" && selectedAnswer !== null;
  const remaining =
    timeLimitMs !== null ? remainingMs(sessionStartedAt, now, timeLimitMs) : null;

  useEffect(() => {
    progressRepository.getFavorites().then(
      (favorites) => {
        const favoritedIds = new Set(favorites.map((f) => f.questionId));
        setFavorited((prev) => {
          const next = { ...prev };
          questions.forEach((q, i) => {
            if (favoritedIds.has(q.questionId)) next[i] = true;
          });
          return next;
        });
      },
      (err) => console.error("getFavorites failed:", err)
    );
  }, [questions]);

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setCurrent(nextIndex);
    setQuestionStartedAt(Date.now());
  }

  function select(answer: number) {
    if (mode === "study") {
      if (selectedAnswer !== null) return;
      setAnswers((prev) => ({ ...prev, [current]: answer }));

      const isCorrect = gradeAnswer(question, answer);
      progressRepository
        .recordAttempt({
          questionId: question.questionId,
          solvedAt: Date.now(),
          mode,
          entryType,
          selectedAnswer: answer,
          isCorrect,
          solveTimeMs: Date.now() - questionStartedAt,
          sessionId,
          timeLimitMs,
        })
        .catch((err) => console.error("recordAttempt failed:", err));

      if (!isCorrect && autoSaveWrongNotes) {
        progressRepository
          .addWrongNote(question.questionId, mode)
          .catch((err) => console.error("addWrongNote failed:", err));
      }
    } else {
      // 시험모드는 답을 자유롭게 바꿀 수 있다 — 고를 때마다 즉시 기록해서 중간 이탈(새로고침 등)에도
      // 유실되지 않게 하되, 재선택 시엔 매번 새 attempt를 추가한다(덮어쓰지 않음). scoreExamSession이
      // 세션 내 같은 문항에 대해 이미 "가장 늦은 solvedAt 우선"으로 채점하므로 별도 로직 없이 정확하다.
      // 제출 시점의 submitExam() 일괄 기록은 그대로 남겨서 최종 확정값 역할을 한다(항상 가장 늦은
      // 타임스탬프를 갖게 되므로, 연타로 인한 저장 순서 레이스가 있어도 결국 이 값이 채점에 반영된다).
      setAnswers((prev) => ({ ...prev, [current]: answer }));
      const isCorrect = gradeAnswer(question, answer);
      progressRepository
        .recordAttempt({
          questionId: question.questionId,
          solvedAt: Date.now(),
          mode,
          entryType,
          selectedAnswer: answer,
          isCorrect,
          solveTimeMs: Date.now() - questionStartedAt,
          sessionId,
          timeLimitMs,
        })
        .catch((err) => console.error("recordAttempt failed:", err));
    }
  }

  function toggleFavorite() {
    const next = !favorited[current];
    setFavorited((prev) => ({ ...prev, [current]: next }));
    const action = next
      ? progressRepository.addFavorite(question.questionId)
      : progressRepository.removeFavorite(question.questionId);
    action.catch((err) => console.error("toggleFavorite failed:", err));
  }

  function submitExam() {
    const answeredCount = Object.keys(answers).length;
    // ponytail: 시험모드는 문항 재선택이 자유로워 문항별 정확한 풀이시간을 못 잰다.
    // 전체 소요시간을 답한 문항 수로 균등 분배한다 — 문항별 세부 통계는 Phase 2.
    const avgSolveTimeMs =
      answeredCount === 0
        ? 0
        : Math.round((Date.now() - sessionStartedAt) / answeredCount);

    for (const [indexStr, answer] of Object.entries(answers)) {
      const q = questions[Number(indexStr)];
      const isCorrect = gradeAnswer(q, answer);
      progressRepository
        .recordAttempt({
          questionId: q.questionId,
          solvedAt: Date.now(),
          mode: "exam",
          entryType,
          selectedAnswer: answer,
          isCorrect,
          solveTimeMs: avgSolveTimeMs,
          sessionId,
          timeLimitMs,
        })
        .catch((err) => console.error("recordAttempt failed:", err));

      if (!isCorrect) {
        progressRepository
          .addWrongNote(q.questionId, "exam")
          .catch((err) => console.error("addWrongNote failed:", err));
      }
    }

    onFinish(summarizeSession(questions, answers));
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (mode === "exam") {
      submitExam();
    } else {
      onFinish(summarizeSession(questions, answers));
    }
  }

  useEffect(() => {
    if (mode !== "exam" || timeLimitMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode, timeLimitMs]);

  useEffect(() => {
    if (remaining === 0) finish();
  }, [remaining, finish]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        select(Number(e.key));
      } else if (e.key === " ") {
        e.preventDefault();
        if (current === questions.length - 1) {
          finish();
        } else {
          goTo(current + 1);
        }
      } else if (e.key === "ArrowRight") {
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(current - 1);
      } else if (e.key === "f" || e.key === "F") {
        toggleFavorite();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xl mx-auto w-full flex items-center justify-between px-6">
        {remaining !== null ? (
          <span className={remaining <= 60_000 ? "text-red-600 font-medium" : "text-gray-500"}>
            남은시간 {formatDuration(remaining)}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {mode === "exam" && (
            <button
              type="button"
              onClick={() => setShowGrid((prev) => !prev)}
              className="text-sm text-gray-500 underline"
            >
              문항현황
            </button>
          )}
          <button type="button" onClick={finish} className="text-sm text-gray-500 underline">
            그만두기
          </button>
        </div>
      </div>
      {mode === "exam" && showGrid && (
        <AnswerGrid
          questions={questions}
          mode="progress"
          answers={answers}
          currentIndex={current}
          onJump={goTo}
        />
      )}
      <QuestionCard
        question={question}
        index={current}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        showFeedback={showFeedback}
        theoryLink={showFeedback ? theoryLink : null}
        isFavorited={favorited[current] ?? false}
        onSelect={select}
        onFavorite={toggleFavorite}
      />
      <div className="max-w-xl mx-auto w-full flex justify-between px-6 text-sm text-gray-500">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← 이전
        </button>
        <span>Space: 다음 · 1~4: 답 선택 · F: 즐겨찾기</span>
        {current === questions.length - 1 ? (
          <button type="button" onClick={finish} className="text-blue-700 font-medium">
            종료
          </button>
        ) : (
          <button type="button" onClick={() => goTo(current + 1)}>
            다음 →
          </button>
        )}
      </div>
    </div>
  );
}
