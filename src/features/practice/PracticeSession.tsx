"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerGrid } from "./AnswerGrid";
import { QuestionCard } from "./QuestionCard";
import { gradeAnswer } from "@/lib/grading";
import { resolveTheoryLink } from "@/lib/theory";
import { summarizeSession, type SessionSummary } from "@/lib/summary";
import { formatDuration, remainingMs } from "@/lib/timer";
import { writeAutoBackup } from "@/lib/autoBackup";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
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
const settingsRepository = new IndexedDbSettingsRepository();

// 세션 종료마다 전체 진행 데이터를 localStorage에 스냅샷으로 남긴다 — 배포 코드
// 문제 등으로 IndexedDB 쪽 실데이터가 유실돼도(#54) 최근 스냅샷으로 즉시 복구
// 가능하게 하는 최선 노력의 안전망이다. 실패해도 세션 종료 흐름은 막지 않는다.
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
  // select()/toggleFavorite()는 IndexedDB 쓰기를 fire-and-forget으로 던진다(중간
  // 이탈 대비 즉시저장, #38) — finish()가 자동백업을 뜨기 전 이 쓰기들이 실제로
  // 끝났는지 추적할 방법이 없으면, 방금 고른 답이나 방금 지워진 오답노트가 아직
  // 반영 안 된 상태로 스냅샷이 찍힐 수 있다. 여기 모아뒀다가 finish에서 기다린다.
  const pendingWritesRef = useRef<Promise<void>[]>([]);

  function trackWrite(promise: Promise<void>): void {
    pendingWritesRef.current.push(promise);
  }

  const question = questions[current];
  const selectedAnswer = answers[current] ?? null;
  const theoryLink = useMemo(
    () => resolveTheoryLink(question, theoryMap),
    [question, theoryMap]
  );
  const showFeedback = mode === "study" && selectedAnswer !== null;
  const remaining =
    timeLimitMs !== null ? remainingMs(sessionStartedAt, now, timeLimitMs) : null;
  // 순서대로 안 풀고 문항현황에서 이리저리 건너뛰며 풀어도, 다 풀었으면 지금 어느
  // 문항에 있든 종료할 수 있어야 한다 — 마지막 문항에 있을 때만 종료 가능하면
  // 안 된다.
  const allAnswered = Object.keys(answers).length === questions.length;

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
      trackWrite(
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
          .catch((err) => console.error("recordAttempt failed:", err))
      );

      if (!isCorrect && autoSaveWrongNotes) {
        trackWrite(
          progressRepository
            .addWrongNote(question.questionId, mode)
            .catch((err) => console.error("addWrongNote failed:", err))
        );
      } else if (isCorrect) {
        // study 모드에서 맞히면 지우되, 그 노트가 시험모드 회차에서 틀려 남은 것이면
        // 지우지 않는다 — 그건 "그 회차 응시 당시의 고정 기록"이라 나중에 복습에서
        // 맞혔다고 사라지면 안 된다(대시보드 오답 배지와 같은 원칙, #46). study 모드에서
        // 틀려서 남은 노트만 "지금도 틀리는지"를 반영해 마스터리 추적 용도로 지운다.
        trackWrite(
          progressRepository
            .getWrongNote(question.questionId)
            .then((note) => {
              // note가 null이면 "노트가 원래 없다"와 "조회 실패로 알 수 없다" 둘 다
              // 해당할 수 있다 — 후자인데 지워버리면 IndexedDB 복구(tombstone reconcile)
              // 과정에서 실제로 남아있던 시험모드 노트가 삭제될 수 있다. mode가 study임을
              // 확인했을 때만 지운다(fail-safe: 확실하지 않으면 그대로 둔다).
              if (note?.mode !== "study") return;
              return progressRepository.removeWrongNote(question.questionId);
            })
            .catch((err) => console.error("removeWrongNote failed:", err))
        );
      }
    } else {
      // 시험모드는 답을 자유롭게 바꿀 수 있다 — 고를 때마다 즉시 기록해서 중간 이탈(새로고침 등)에도
      // 유실되지 않게 한다. recordAttempt는 (questionId, sessionId) 기준 upsert라 재선택해도
      // attempts에 중복 row가 쌓이지 않고 questionStats도 부풀려지지 않는다(#41).
      // submitExam()은 이 즉시기록을 다시 반복 기록하지 않는다 — 여기서 기록한 값이 곧 최종값이다.
      setAnswers((prev) => ({ ...prev, [current]: answer }));
      const isCorrect = gradeAnswer(question, answer);
      trackWrite(
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
          .catch((err) => console.error("recordAttempt failed:", err))
      );

      if (isCorrect) {
        // 재선택으로 정답을 맞혔으면 즉시 지운다 — submitExam()은 최종 오답만 추가할 뿐
        // 이전에 붙어있던 노트를 지우지는 않는다(자기 담당이 아님).
        trackWrite(
          progressRepository
            .removeWrongNote(question.questionId)
            .catch((err) => console.error("removeWrongNote failed:", err))
        );
      }
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

  function submitExam(): void {
    // select()가 답을 고를 때마다 이미 recordAttempt로 즉시 기록하므로, 여기서는 다시 기록하지
    // 않는다 — 반복 기록하면 questionStats의 정답/오답 카운트가 문항당 최소 2배로 부풀려진다.
    for (const [indexStr, answer] of Object.entries(answers)) {
      const q = questions[Number(indexStr)];
      const isCorrect = gradeAnswer(q, answer);

      if (!isCorrect) {
        trackWrite(
          progressRepository
            .addWrongNote(q.questionId, "exam")
            .catch((err) => console.error("addWrongNote failed:", err))
        );
      }
    }

    onFinish(summarizeSession(questions, answers));
  }

  async function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (mode === "exam") {
      submitExam();
    } else {
      onFinish(summarizeSession(questions, answers));
    }
    // select()/toggleFavorite()의 fire-and-forget 쓰기와 submitExam()이 방금 추가한
    // 오답노트 쓰기까지 전부 끝난 뒤에 스냅샷을 찍는다 — 안 그러면 방금 고른 답이나
    // 방금 지워진/추가된 오답노트가 반영 안 된 채로 자동백업이 찍힐 수 있다.
    await Promise.all(pendingWritesRef.current);
    void runAutoBackup();
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
        if (current === questions.length - 1 || allAnswered) {
          finish();
        } else {
          goTo(current + 1);
        }
      } else if (e.key === "ArrowRight") {
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(current - 1);
      } else if (e.key === "ArrowDown") {
        // 문항현황이 10칸짜리 그리드라(시험모드에서만 보임) 아래/위는 한 칸이 아니라
        // 한 행(±10칸) 이동한다. 문항현황이 없는 학습모드는 한 칸씩 이동한다.
        goTo(current + (mode === "exam" ? 10 : 1));
      } else if (e.key === "ArrowUp") {
        goTo(current - (mode === "exam" ? 10 : 1));
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
        <span>Space: 다음 · ←→: 이전/다음 · ↑↓: 이동 · 1~4: 답 선택 · F: 즐겨찾기</span>
        {current === questions.length - 1 || allAnswered ? (
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
