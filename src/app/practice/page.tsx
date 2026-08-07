"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { AnswerGrid } from "@/features/practice/AnswerGrid";
import { pickRandomQuestions, pickStratifiedRandomQuestions } from "@/lib/sampling";
import { gradeAnswer } from "@/lib/grading";
import { isPassed, isSubjectFailed, summarizeBySubject, type SessionSummary } from "@/lib/summary";
import { SUBJECT_NAMES } from "@/lib/theory";
import { getUnansweredQuestions, pickResumeSession } from "@/lib/resumeExam";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { EntryType, Mode } from "@/types/progress";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();
const progressRepository = new IndexedDbProgressRepository();
const settingsRepository = new IndexedDbSettingsRepository();

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
      initialAnswers?: Record<number, number>;
      initialSessionId?: string;
      initialSessionStartedAt?: number;
    }
  | { kind: "done"; summary: SessionSummary; mode: Mode; entryType: EntryType }
  | { kind: "error"; message: string };

function PracticeContent() {
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
      : subjectParam && Number.isInteger(subjectNum) && subjectNum in SUBJECT_NAMES
        ? subjectNum
        : undefined;

  const countParam = searchParams.get("count");
  const initialCount: 20 | 40 | 100 | undefined =
    countParam === "20" || countParam === "40" || countParam === "100" ? (Number(countParam) as 20 | 40 | 100) : undefined;

  const limitParam = searchParams.get("limit");
  const limitMinutes = Number(limitParam);
  const limitMs = limitMinutes * 60 * 1000;
  const initialTimeLimitMs: number | undefined =
    limitParam && Number.isFinite(limitMinutes) && limitMinutes > 0 && Number.isFinite(limitMs)
      ? limitMs
      : undefined;

  // review/page.tsx의 latestRequestId 패턴과 동일 — resumeExamId가 로드 도중
  // 바뀌면(같은 /practice 인스턴스에서 다른 회차로 재진입) 먼저 시작한 로드가
  // 나중에 끝나며 최신 상태를 덮어쓰지 않게 막는다.
  const latestResumeRequestId = useRef(0);

  useEffect(() => {
    if (!resumeExamId) {
      // resume 쿼리가 사라졌으면(예: nav의 "문제풀이" 링크로 같은 /practice 인스턴스에
      // 머무른 채 재진입) 진행 중이던 resume 로드를 무효화하고 setup 화면으로 되돌린다.
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

        // entryType이 round가 아니면(random) 원래 문항 집합을 재구성할 방법이 없다 —
        // 어떤 문항이 원래 뽑혔었는지는 attempt가 기록된 것만 알 수 있고, 안 풀고 넘어간
        // 문항은 애초에 저장된 적이 없다. 이 경우 기존 동작(학습모드, 안 푼 문항만)으로 대체한다.
        // 학습모드는 이 복원 경로를 타면 안 된다 — select()가 이미 답한 문항에서 즉시
        // return하며 정답 피드백이 펼쳐진 채로 나오므로, 시험모드(entryType === "round")에서만 사용한다.
        // 제한시간이 이미 지난 세션도 제외한다 — 복원하자마자 remaining이 0이라 즉시
        // 자동제출되는데, submitExam()은 답한 문항만 기록하므로 안 푼 문항은 영원히
        // 미응시로 남아 "이어서 풀기"를 눌러도 같은 만료 세션을 계속 다시 고르는 루프에 빠진다.
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
  }, [resumeExamId]);

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
        questions =
          value.subject === "all"
            ? pickStratifiedRandomQuestions(pool, value.count)
            : pickRandomQuestions(pool, value.count);
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
    return (
      <PracticeSetup
        onStart={start}
        initialEntryType={initialEntryType}
        initialMode={initialMode}
        initialSubject={initialSubject}
        initialCount={initialCount}
        initialTimeLimitMs={initialTimeLimitMs}
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
    const { total, solved, correct, wrong, questions, answers } = phase.summary;
    const subjectScores = summarizeBySubject(questions, answers);
    const showPassFail = phase.entryType === "round" && phase.mode === "exam";
    const wrongQuestions = questions.filter(
      (q, i) => !(i in answers) || !gradeAnswer(q, answers[i])
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
