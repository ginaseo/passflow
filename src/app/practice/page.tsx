"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { AnswerGrid } from "@/features/practice/AnswerGrid";
import { isPassed, isSubjectFailed, summarizeBySubject, type SessionSummary } from "@/lib/summary";
import { getSubjectLabel } from "@/lib/theory";
import { getUnansweredQuestions, pickResumeSession } from "@/lib/resumeExam";
import { ApiQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import { getSelectedCertId, DEFAULT_CERT_ID } from "@/lib/cert";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { EntryType, Mode } from "@/types/progress";
import type { PublicQuestion } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const progressRepository = new IndexedDbProgressRepository();
const settingsRepository = new IndexedDbSettingsRepository();

type Phase =
  | { kind: "setup" }
  | { kind: "loading" }
  | {
      kind: "active";
      questions: PublicQuestion[];
      theoryMap: TheoryMap;
      mode: Mode;
      entryType: EntryType;
      timeLimitMs: number | null;
      autoSaveWrongNotes: boolean;
      initialAnswers?: Record<number, number>;
      initialSessionId?: string;
      initialSessionStartedAt?: number;
    }
  | { kind: "done"; summary: SessionSummary; mode: Mode; entryType: EntryType }
  | { kind: "error"; message: string };

async function resolveSampleCount(
  value: Extract<PracticeSetupValue, { entryType: "random" }>,
  certId: string,
  repo: ApiQuestionRepository
): Promise<number> {
  if (value.count !== Infinity) return value.count;
  const metadata = await repo.getMetadata();
  if (value.examIds && value.examIds.length > 0) {
    return value.examIds.reduce((sum, id) => {
      const exam = metadata.exams.find((e) => e.examId === id);
      return sum + (exam?.count ?? 0);
    }, 0);
  }
  if (value.subject === "all") return metadata.subjectCounts.all ?? 0;
  return metadata.subjectCounts[String(value.subject)] ?? 0;
}

function PracticeContent() {
  const [certId, setCertId] = useState(DEFAULT_CERT_ID);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCertId(getSelectedCertId());
  }, []);
  const questionRepository = useMemo(() => new ApiQuestionRepository(certId), [certId]);
  const searchParams = useSearchParams();
  const resumeExamId = searchParams.get("resume");
  const [phase, setPhase] = useState<Phase>(resumeExamId ? { kind: "loading" } : { kind: "setup" });

  const entryParam = searchParams.get("entry");
  const initialEntryType =
    entryParam === "round" ? "round" : entryParam === "random" ? "random" : undefined;

  const modeParam = searchParams.get("mode");
  const initialMode: Mode | undefined = modeParam === "study" || modeParam === "exam" ? modeParam : undefined;

  const subjectParam = searchParams.get("subject");
  const subjectNum = Number(subjectParam);
  const initialSubject: number | "all" | undefined =
    subjectParam === "all"
      ? "all"
      : subjectParam && Number.isInteger(subjectNum) && subjectNum > 0
        ? subjectNum
        : undefined;

  const countParam = searchParams.get("count");
  const countNum = Number(countParam);
  const initialCount: number | undefined =
    countParam && Number.isInteger(countNum) && countNum > 0 ? countNum : undefined;

  const latestResumeRequestId = useRef(0);

  useEffect(() => {
    if (!resumeExamId) {
      latestResumeRequestId.current++;
      queueMicrotask(() => {
        setPhase((prev) => (prev.kind === "setup" ? prev : { kind: "setup" }));
      });
      return;
    }
    const requestId = ++latestResumeRequestId.current;

    (async () => {
      setPhase({ kind: "loading" });
      try {
        const [pool, attempts, theoryMap, settings] = await Promise.all([
          questionRepository.getQuestions({ examId: resumeExamId }),
          progressRepository.getAttempts(),
          questionRepository.getTheoryMap(),
          settingsRepository.getSettings().catch(() => DEFAULT_SETTINGS),
        ]);
        if (requestId !== latestResumeRequestId.current) return;

        const resumeSession = pickResumeSession(attempts, resumeExamId);

        const isExpired =
          resumeSession !== null &&
          resumeSession.timeLimitMs !== null &&
          Date.now() - resumeSession.startedAt >= resumeSession.timeLimitMs;
        if (resumeSession && resumeSession.mode === "exam" && resumeSession.entryType === "round" && !isExpired) {
          const questions = [...pool].sort((a, b) => a.qnum - b.qnum);
          if (questions.length === 0) {
            setPhase({ kind: "error", message: "이어서 풀 문항이 없다." });
            return;
          }

          const initialAnswers: Record<number, number> = {};
          questions.forEach((q, index) => {
            const answer = resumeSession.answersByQnum[q.qnum];
            if (answer !== undefined) initialAnswers[index] = answer;
          });

          setPhase({
            kind: "active",
            questions,
            theoryMap,
            mode: resumeSession.mode,
            entryType: "round",
            timeLimitMs: resumeSession.timeLimitMs,
            autoSaveWrongNotes: settings.autoSaveWrongNotes,
            initialAnswers,
            initialSessionId: resumeSession.sessionId,
            initialSessionStartedAt: resumeSession.startedAt,
          });
          return;
        }

        const questions = getUnansweredQuestions(pool, attempts, resumeExamId).sort(
          (a, b) => a.qnum - b.qnum
        );

        if (questions.length === 0) {
          setPhase({ kind: "error", message: "이어서 풀 문항이 없다." });
          return;
        }

        setPhase({
          kind: "active",
          questions,
          theoryMap,
          mode: "study",
          entryType: "round",
          timeLimitMs: null,
          autoSaveWrongNotes: settings.autoSaveWrongNotes,
        });
      } catch {
        if (requestId !== latestResumeRequestId.current) return;
        setPhase({ kind: "error", message: "이어서 풀 문항을 불러오지 못했다. 다시 시도해달라." });
      }
    })();
  }, [resumeExamId, questionRepository]);

  async function start(value: PracticeSetupValue) {
    setPhase({ kind: "loading" });

    try {
      const theoryMapPromise = questionRepository.getTheoryMap();
      theoryMapPromise.catch(() => {});
      const settingsPromise = settingsRepository.getSettings().catch(() => DEFAULT_SETTINGS);

      let questions: PublicQuestion[];

      if (value.entryType === "round") {
        const pool = await questionRepository.getQuestions({ examId: value.examId });
        questions = [...pool].sort((a, b) => a.qnum - b.qnum);
      } else {
        const count = await resolveSampleCount(value, certId, questionRepository);
        questions = await questionRepository.sampleQuestions({
          examIds: value.examIds,
          subject: value.subject,
          count,
          order: value.order,
          stratified: value.subject === "all",
        });
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

  async function retryWrong(wrongQuestions: PublicQuestion[]) {
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
    return (
      <PracticeSetup
        questionRepository={questionRepository}
        certId={certId}
        onStart={start}
        initialEntryType={initialEntryType}
        initialMode={initialMode}
        initialSubject={initialSubject}
        initialCount={initialCount}
      />
    );
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
    const { total, solved, correct, wrong, questions, answers, correctByIndex } = phase.summary;
    const subjectScores = summarizeBySubject(questions, answers, correctByIndex);
    const showPassFail = phase.entryType === "round" && phase.mode === "exam";
    const wrongQuestions = questions.filter(
      (q, i) => !(i in answers) || correctByIndex?.[i] !== true
    );

    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-gray-600">
          {total}문제 중 {solved}문제 풀이 — 정답 {correct} · 오답 {wrong}
        </p>
        {showPassFail && (
          <div className="flex flex-col gap-2 p-3 rounded border w-fit min-w-[240px]">
            <p
              className={`font-medium ${isPassed(subjectScores) ? "text-green-700" : "text-red-700"}`}
            >
              {isPassed(subjectScores) ? "합격" : "불합격"}
            </p>
            <ul className="text-sm text-left flex flex-col gap-1">
              {subjectScores.map((score) => (
                <li key={score.subject} className={isSubjectFailed(score) ? "text-red-700" : ""}>
                  {getSubjectLabel(score)}: {score.correct}/{score.total}
                  {isSubjectFailed(score) ? " (과락)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <AnswerGrid
          questions={questions}
          mode="result"
          answers={answers}
          correctByIndex={correctByIndex}
        />
        {wrongQuestions.length > 0 && (
          <button
            type="button"
            onClick={() => retryWrong(wrongQuestions)}
            className="px-4 py-2 rounded border font-medium"
          >
            오답 문제 다시풀기 ({wrongQuestions.length}문제)
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
      questionRepository={questionRepository}
      questions={phase.questions}
      theoryMap={phase.theoryMap}
      mode={phase.mode}
      entryType={phase.entryType}
      timeLimitMs={phase.timeLimitMs}
      autoSaveWrongNotes={phase.autoSaveWrongNotes}
      initialAnswers={phase.initialAnswers}
      initialSessionId={phase.initialSessionId}
      initialSessionStartedAt={phase.initialSessionStartedAt}
      onFinish={(summary) => setPhase({ kind: "done", summary, mode: phase.mode, entryType: phase.entryType })}
    />
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<p className="text-center p-10">불러오는 중...</p>}>
      <PracticeContent />
    </Suspense>
  );
}
