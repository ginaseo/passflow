"use client";

import { useState } from "react";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { AnswerGrid } from "@/features/practice/AnswerGrid";
import { pickRandomQuestions } from "@/lib/sampling";
import { gradeAnswer } from "@/lib/grading";
import { isPassed, isSubjectFailed, summarizeBySubject, type SessionSummary } from "@/lib/summary";
import { SUBJECT_NAMES } from "@/lib/theory";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { Mode } from "@/types/progress";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();
const settingsRepository = new IndexedDbSettingsRepository();

type EntryType = "round" | "random";

type Phase =
  | { kind: "setup" }
  | { kind: "loading" }
  | {
      kind: "active";
      questions: Question[];
      theoryMap: TheoryMap;
      mode: Mode;
      entryType: EntryType;
      timeLimitMs: number | null;
      autoSaveWrongNotes: boolean;
    }
  | { kind: "done"; summary: SessionSummary; mode: Mode; entryType: EntryType }
  | { kind: "error"; message: string };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  async function start(value: PracticeSetupValue) {
    setPhase({ kind: "loading" });

    try {
      const theoryMapPromise = questionRepository.getTheoryMap();
      theoryMapPromise.catch(() => {}); // 실제 에러 처리는 아래 await 시점에서 수행됨 — unhandled rejection 방지용
      // 설정 조회 실패는 세션 시작을 막지 않는다 — 기본값으로 대체
      const settingsPromise = settingsRepository.getSettings().catch(() => DEFAULT_SETTINGS);

      let questions: Question[];

      if (value.entryType === "round") {
        const pool = await questionRepository.getQuestions({ examId: value.examId });
        questions = [...pool].sort((a, b) => a.qnum - b.qnum);
      } else {
        const pool = await questionRepository.getQuestions(
          value.subject === "all" ? {} : { subject: value.subject }
        );
        questions = pickRandomQuestions(pool, value.count);
      }

      const theoryMap = await theoryMapPromise;
      const settings = await settingsPromise;

      if (questions.length === 0) {
        setPhase({ kind: "error", message: "문제를 찾을 수 없다. 다시 시도해달라." });
        return;
      }

      setPhase({
        kind: "active",
        questions,
        theoryMap,
        mode: value.mode,
        entryType: value.entryType,
        timeLimitMs: value.timeLimitMs,
        autoSaveWrongNotes: settings.autoSaveWrongNotes,
      });
    } catch {
      setPhase({ kind: "error", message: "문제를 불러오지 못했다. 다시 시도해달라." });
    }
  }

  async function retryWrong(wrongQuestions: Question[]) {
    if (wrongQuestions.length === 0) return;
    try {
      const [theoryMap, settings] = await Promise.all([
        questionRepository.getTheoryMap(),
        settingsRepository.getSettings().catch(() => DEFAULT_SETTINGS),
      ]);
      setPhase({
        kind: "active",
        questions: wrongQuestions,
        theoryMap,
        mode: "study",
        entryType: "random",
        timeLimitMs: null,
        autoSaveWrongNotes: settings.autoSaveWrongNotes,
      });
    } catch {
      setPhase({ kind: "error", message: "문제를 불러오지 못했다. 다시 시도해달라." });
    }
  }

  if (phase.kind === "setup") {
    return <PracticeSetup onStart={start} />;
  }

  if (phase.kind === "loading") {
    return <p className="text-center p-10">문제 불러오는 중...</p>;
  }

  if (phase.kind === "error") {
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium text-red-700">{phase.message}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "setup" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (phase.kind === "done") {
    const { total, solved, correct, wrong, questions, answers } = phase.summary;
    const subjectScores = summarizeBySubject(questions, answers);
    const showPassFail = phase.entryType === "round" && phase.mode === "exam";
    const wrongQuestions = questions.filter(
      (q, i) => !(i in answers) || !gradeAnswer(q, answers[i])
    );

    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">수고했다.</p>
        <p className="text-gray-600">
          {total}문제 중 {solved}문제 풀이 — 정답 {correct} · 오답 {wrong}
        </p>
        {showPassFail && (
          <div className="flex flex-col gap-2 p-4 rounded border max-w-sm w-full">
            <p
              className={`font-medium ${isPassed(subjectScores) ? "text-green-700" : "text-red-700"}`}
            >
              {isPassed(subjectScores) ? "합격" : "불합격"}
            </p>
            <ul className="text-sm text-left flex flex-col gap-1">
              {subjectScores.map((score) => (
                <li key={score.subject} className={isSubjectFailed(score) ? "text-red-700" : ""}>
                  {SUBJECT_NAMES[score.subject]}: {score.correct}/{score.total}
                  {isSubjectFailed(score) ? " (과락)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <AnswerGrid questions={questions} mode="result" answers={answers} />
        {wrongQuestions.length > 0 && (
          <button
            type="button"
            onClick={() => retryWrong(wrongQuestions)}
            className="px-4 py-2 rounded border font-medium"
          >
            틀린 문제만 다시풀기 ({wrongQuestions.length}문제)
          </button>
        )}
        <button
          type="button"
          onClick={() => setPhase({ kind: "setup" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          다시 풀기
        </button>
      </div>
    );
  }

  return (
    <PracticeSession
      questions={phase.questions}
      theoryMap={phase.theoryMap}
      mode={phase.mode}
      timeLimitMs={phase.timeLimitMs}
      autoSaveWrongNotes={phase.autoSaveWrongNotes}
      onFinish={(summary) => setPhase({ kind: "done", summary, mode: phase.mode, entryType: phase.entryType })}
    />
  );
}
