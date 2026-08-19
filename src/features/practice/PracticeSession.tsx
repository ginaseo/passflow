"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnswerGrid } from "./AnswerGrid";
import { QuestionCard, type QuestionFeedback } from "./QuestionCard";
import { resolveTheoryLink } from "@/lib/theory";
import { summarizeFromSubmitResult, summarizeSession, type SessionSummary } from "@/lib/summary";
import { formatDuration, remainingMs } from "@/lib/timer";
import { writeAutoBackup } from "@/lib/autoBackup";
import type { QuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import type { EntryType, Mode } from "@/types/progress";
import type { PublicQuestion, SelectedAnswer } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

interface PracticeSessionProps {
  questionRepository: QuestionRepository;
  questions: PublicQuestion[];
  theoryMap: TheoryMap;
  mode: Mode;
  entryType: EntryType;
  timeLimitMs: number | null;
  autoSaveWrongNotes: boolean;
  onFinish: (summary: SessionSummary) => void;
  initialAnswers?: Record<number, SelectedAnswer>;
  initialSessionId?: string;
  initialSessionStartedAt?: number;
}

const progressRepository = new IndexedDbProgressRepository();
const settingsRepository = new IndexedDbSettingsRepository();

async function runAutoBackup(): Promise<void> {
  try {
    const [attempts, wrongNotes, favorites, settings] = await Promise.all([
      progressRepository.getAttempts(),
      progressRepository.getWrongNotes(),
      progressRepository.getFavorites(),
      settingsRepository.getSettings(),
    ]);
    const questionIds = [...new Set(attempts.map((a) => a.questionId))];
    const questionStats = await Promise.all(
      questionIds.map((id) => progressRepository.getQuestionStats(id))
    );
    writeAutoBackup({ attempts, questionStats, wrongNotes, favorites, settings });
  } catch (err) {
    console.error("autoBackup failed:", err);
  }
}

export function PracticeSession({
  questionRepository,
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
  const [answers, setAnswers] = useState<Record<number, SelectedAnswer>>(() => initialAnswers ?? {});
  const [feedbackByIndex, setFeedbackByIndex] = useState<Record<number, QuestionFeedback>>({});
  const [favorited, setFavorited] = useState<Record<number, boolean>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sessionStartedAt] = useState(() => initialSessionStartedAt ?? Date.now());
  const [sessionId] = useState(() => initialSessionId ?? `session-${crypto.randomUUID()}`);
  const finishedRef = useRef(false);
  const [showGrid, setShowGrid] = useState(false);
  const pendingWritesRef = useRef<Promise<void>[]>([]);

  function trackWrite(promise: Promise<void>): void {
    pendingWritesRef.current.push(promise);
  }

  const question = questions[current];
  const selectedAnswer = answers[current] ?? null;
  const feedback = feedbackByIndex[current] ?? null;
  const theoryLink = useMemo(
    () => (feedback ? resolveTheoryLink(question, theoryMap) : null),
    [question, theoryMap, feedback]
  );
  const showFeedback = mode === "study" && selectedAnswer !== null && feedback !== null;
  const remaining =
    timeLimitMs !== null ? remainingMs(sessionStartedAt, now, timeLimitMs) : null;
  const allAnswered = questions.every((q, i) => {
    const required = q.answerCount ?? 1;
    const a = answers[i];
    const count = a === undefined ? 0 : Array.isArray(a) ? a.length : 1;
    return count >= required;
  });

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

  // "2개 고르시오" 같은 문항은 정답 개수(question.answerCount)만큼 고를 때까지는
  // 채점하지 않는다 — 그 전까지는 answers에 진행 중인 선택만 반영한다. 정답이 1개인
  // 문항은 항상 requiredCount===1이라 클릭 즉시 채점되는 기존 동작 그대로다.
  async function select(optionNumber: number) {
    const requiredCount = question.answerCount ?? 1;
    const current_ = answers[current];
    const currentSet = current_ === undefined ? [] : Array.isArray(current_) ? current_ : [current_];

    let nextSet: number[];
    if (requiredCount === 1) {
      if (currentSet.length > 0) return;
      nextSet = [optionNumber];
    } else if (currentSet.includes(optionNumber)) {
      nextSet = currentSet.filter((n) => n !== optionNumber);
    } else {
      if (currentSet.length >= requiredCount) return;
      nextSet = [...currentSet, optionNumber];
    }

    const nextValue: SelectedAnswer = requiredCount > 1 ? nextSet : optionNumber;
    setAnswers((prev) => ({ ...prev, [current]: nextValue }));

    if (nextSet.length < requiredCount) return;

    if (mode === "study") {
      try {
        const grade = await questionRepository.gradeQuestion(question.questionId, nextValue);
        setFeedbackByIndex((prev) => ({
          ...prev,
          [current]: {
            correct: grade.correct,
            explanation: grade.explanation,
            correctAnswer: grade.correctAnswer,
          },
        }));

        trackWrite(
          progressRepository
            .recordAttempt({
              questionId: question.questionId,
              solvedAt: Date.now(),
              mode,
              entryType,
              selectedAnswer: nextValue,
              isCorrect: grade.correct,
              solveTimeMs: Date.now() - questionStartedAt,
              sessionId,
              timeLimitMs,
              sessionStartedAt,
            })
            .catch((err) => console.error("recordAttempt failed:", err))
        );

        if (!grade.correct && autoSaveWrongNotes) {
          trackWrite(
            progressRepository
              .addWrongNote(question.questionId, mode)
              .catch((err) => console.error("addWrongNote failed:", err))
          );
        } else if (grade.correct) {
          trackWrite(
            progressRepository
              .getWrongNote(question.questionId)
              .then((note) => {
                if (note?.mode !== "study") return;
                return progressRepository.removeWrongNote(question.questionId);
              })
              .catch((err) => console.error("removeWrongNote failed:", err))
          );
        }
      } catch (err) {
        console.error("gradeQuestion failed:", err);
      }
    } else {
      trackWrite(
        progressRepository
          .recordAttempt({
            questionId: question.questionId,
            solvedAt: Date.now(),
            mode,
            entryType,
            selectedAnswer: nextValue,
            isCorrect: false,
            solveTimeMs: Date.now() - questionStartedAt,
            sessionId,
            timeLimitMs,
            sessionStartedAt,
          })
          .catch((err) => console.error("recordAttempt failed:", err))
      );
    }
  }

  function toggleFavorite() {
    const next = !favorited[current];
    setFavorited((prev) => ({ ...prev, [current]: next }));
    const action = next
      ? progressRepository.addFavorite(question.questionId)
      : progressRepository.removeFavorite(question.questionId);
    trackWrite(action.catch((err) => console.error("toggleFavorite failed:", err)));
  }

  const submitExam = useCallback(async (): Promise<void> => {
    const items = Object.entries(answers).map(([indexStr, selectedAnswer]) => ({
      questionId: questions[Number(indexStr)].questionId,
      selectedAnswer,
    }));

    try {
      const submit = await questionRepository.submitExam(items);

      for (const result of submit.results) {
        const index = questions.findIndex((q) => q.questionId === result.questionId);
        if (index < 0) continue;
        const selected = answers[index];

        trackWrite(
          progressRepository
            .recordAttempt({
              questionId: result.questionId,
              solvedAt: Date.now(),
              mode,
              entryType,
              selectedAnswer: selected,
              isCorrect: result.correct,
              solveTimeMs: 0,
              sessionId,
              timeLimitMs,
              sessionStartedAt,
            })
            .catch((err) => console.error("recordAttempt failed:", err))
        );

        if (!result.correct) {
          trackWrite(
            progressRepository
              .addWrongNote(result.questionId, "exam")
              .catch((err) => console.error("addWrongNote failed:", err))
          );
        }
      }

      onFinish(summarizeFromSubmitResult(questions, answers, submit));
    } catch (err) {
      console.error("submitExam failed:", err);
    }
  }, [answers, onFinish, questions, questionRepository, entryType, mode, sessionId, sessionStartedAt, timeLimitMs]);

  const finish = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (mode === "exam") {
      await submitExam();
    } else {
      const correctByIndex: Record<number, boolean> = {};
      for (const [indexStr, fb] of Object.entries(feedbackByIndex)) {
        correctByIndex[Number(indexStr)] = fb.correct;
      }
      onFinish(summarizeSession(questions, answers, correctByIndex));
    }

    await Promise.all(pendingWritesRef.current);
    void runAutoBackup();
  }, [mode, questions, answers, feedbackByIndex, onFinish, submitExam]);

  useEffect(() => {
    if (mode !== "exam" || timeLimitMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mode, timeLimitMs]);

  useEffect(() => {
    if (remaining === 0) void finish();
  }, [remaining, finish]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        void select(Number(e.key));
      } else if (e.key === " ") {
        e.preventDefault();
        if (current === questions.length - 1 || allAnswered) {
          void finish();
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
          <button type="button" onClick={() => void finish()} className="text-sm text-gray-500 underline">
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
        feedback={feedback}
        theoryLink={showFeedback ? theoryLink : null}
        isFavorited={favorited[current] ?? false}
        onSelect={(answer) => void select(answer)}
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
        <span>Space: 다음 · ←→: 이전/다음 · 1~4: 답 선택 · F: 즐겨찾기</span>
        {current === questions.length - 1 || allAnswered ? (
          <button type="button" onClick={() => void finish()} className="text-blue-700 font-medium">
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
