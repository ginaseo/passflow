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
          sessionStartedAt,
        })
        .catch((err) => console.error("recordAttempt failed:", err));

      if (!isCorrect && autoSaveWrongNotes) {
        progressRepository
          .addWrongNote(question.questionId, mode)
          .catch((err) => console.error("addWrongNote failed:", err));
      } else if (isCorrect) {
        // 이전에 어떤 모드로든 틀려서 오답노트에 남아있었다면, 맞혔으니 지운다 —
        // 그래야 오답노트/회차별 오답 집계가 "현재도 틀린 문항"만 반영한다.
        progressRepository
          .removeWrongNote(question.questionId)
          .catch((err) => console.error("removeWrongNote failed:", err));
      }
    } else {
      // 시험모드는 답을 자유롭게 바꿀 수 있다 — 고를 때마다 즉시 기록해서 중간 이탈(새로고침 등)에도
      // 유실되지 않게 한다. recordAttempt는 (questionId, sessionId) 기준 upsert라 재선택해도
      // attempts에 중복 row가 쌓이지 않고 questionStats도 부풀려지지 않는다(#41).
      // submitExam()은 이 즉시기록을 다시 반복 기록하지 않는다 — 여기서 기록한 값이 곧 최종값이다.
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
          sessionStartedAt,
        })
        .catch((err) => console.error("recordAttempt failed:", err));

      if (isCorrect) {
        // 재선택으로 정답을 맞혔으면 즉시 지운다 — submitExam()은 최종 오답만 추가할 뿐
        // 이전에 붙어있던 노트를 지우지는 않는다(자기 담당이 아님).
        progressRepository
          .removeWrongNote(question.questionId)
          .catch((err) => console.error("removeWrongNote failed:", err));
      }
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
    // select()가 답을 고를 때마다 이미 recordAttempt로 즉시 기록하므로, 여기서는 다시 기록하지
    // 않는다 — 반복 기록하면 questionStats의 정답/오답 카운트가 문항당 최소 2배로 부풀려진다.
    for (const [indexStr, answer] of Object.entries(answers)) {
      const q = questions[Number(indexStr)];
      const isCorrect = gradeAnswer(q, answer);

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
        mode={mode}
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
