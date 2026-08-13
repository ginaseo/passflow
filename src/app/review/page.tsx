"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewList } from "@/features/review/ReviewList";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { getAllSolvedQuestionIds } from "@/lib/recentlySolved";
import { pickRandomQuestions } from "@/lib/sampling";
import { tryParseQuestionId } from "@/lib/questionId";
import { getExamSessionWrongQuestionIds, listExamSessions } from "@/lib/latestExamResult";
import { getSubjectLabel } from "@/lib/theory";
import type { Mode, WrongNote } from "@/types/progress";
import type { SessionSummary } from "@/lib/summary";
import { JsonQuestionRepository, type QuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import { IndexedDbSettingsRepository } from "@/repositories/SettingsRepository";
import { getSelectedCertId } from "@/lib/cert";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const progressRepository = new IndexedDbProgressRepository();
const settingsRepository = new IndexedDbSettingsRepository();

type Tab = "wrong" | "favorite" | "recent";

type Phase =
  | { kind: "list" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap; autoSaveWrongNotes: boolean }
  | { kind: "done"; summary: SessionSummary }
  | { kind: "error"; message: string };

const TAB_LABEL: Record<Tab, string> = {
  wrong: "오답노트",
  favorite: "즐겨찾기",
  recent: "최근 푼 문제",
};

const EMPTY_MESSAGE: Record<Tab, string> = {
  wrong: "오답노트가 비어있다.",
  favorite: "즐겨찾기한 문제가 없다.",
  recent: "최근 푼 문제가 없다.",
};

async function hydrate(questionRepository: QuestionRepository, questionIds: string[]): Promise<Question[]> {
  const results = await Promise.allSettled(
    questionIds.map((id) => questionRepository.getQuestion(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Question> => r.status === "fulfilled")
    .map((r) => r.value);
}

async function fetchTabQuestions(
  questionRepository: QuestionRepository,
  nextTab: Tab,
  modeFilter: "all" | "study" | "exam",
  roundFilter: string,
  sessionIdFilter: string | null
): Promise<{ questions: Question[]; wrongNotesById: Map<string, WrongNote>; modeById: Map<string, Mode> }> {
  let questionIds: string[];
  let wrongNotesById = new Map<string, WrongNote>();

  // 즐겨찾기/최근 푼 문제 탭에도 "어떤 모드로 풀었는지"를 보여주기 위해 attempts에서
  // 문항별 가장 최근 mode를 뽑아둔다 — Favorite엔 mode 필드가 아예 없고, 최근 푼 문제는
  // 여러 mode로 풀렸을 수 있어 가장 최근 시도 기준으로 하나만 고른다.
  const attempts = await progressRepository.getAttempts();
  const modeById = new Map<string, Mode>();
  for (const a of [...attempts].sort((x, y) => x.solvedAt - y.solvedAt)) {
    modeById.set(a.questionId, a.mode);
  }

  if (nextTab === "wrong" && modeFilter === "exam") {
    const sessions = listExamSessions(attempts);
    const targetExamIds =
      roundFilter === "all" ? [...new Set(sessions.map((session) => session.examId))] : [roundFilter];
    const questionIds = new Set<string>();
    const wrongNotesById = new Map<string, WrongNote>();

    for (const examId of targetExamIds) {
      // sessionIdFilter가 있으면 roundFilter 값과 무관하게 그 세션만 고른다 — 대시보드
      // 딥링크(examId+sessionId)로 들어온 뒤 회차 드롭다운을 "전체"로 바꿔도(URL의
      // sessionId는 그대로 남는다) 엉뚱한 회차의 최신 세션이 섞여 나오지 않게 한다.
      const session = sessionIdFilter
        ? sessions.find((item) => item.examId === examId && item.sessionId === sessionIdFilter)
        : sessions.find((item) => item.examId === examId);
      if (!session) continue;

      const examQuestions = await questionRepository.getQuestions({ examId });
      const wrongIds = getExamSessionWrongQuestionIds(examQuestions, attempts, examId, session.sessionId);
      for (const questionId of wrongIds) {
        questionIds.add(questionId);
        wrongNotesById.set(questionId, {
          questionId,
          addedAt: session.solvedAt,
          mode: "exam",
        });
        modeById.set(questionId, "exam");
      }
    }

    const questions = await hydrate(questionRepository, [...questionIds]);
    questions.sort((a, b) => {
      const examA = tryParseQuestionId(a.questionId)?.examId ?? "";
      const examB = tryParseQuestionId(b.questionId)?.examId ?? "";
      return examB.localeCompare(examA) || a.qnum - b.qnum;
    });

    return { questions, wrongNotesById, modeById };
  }

  if (nextTab === "wrong") {
    const notes = await progressRepository.getWrongNotes();
    const sorted = notes.sort((a, b) => b.addedAt - a.addedAt);
    questionIds = sorted.map((n) => n.questionId);
    wrongNotesById = new Map(sorted.map((n) => [n.questionId, n]));
  } else if (nextTab === "favorite") {
    const favorites = await progressRepository.getFavorites();
    questionIds = favorites.sort((a, b) => b.addedAt - a.addedAt).map((n) => n.questionId);
  } else {
    questionIds = getAllSolvedQuestionIds(attempts);
  }

  const questions = await hydrate(questionRepository, questionIds);
  return { questions, wrongNotesById, modeById };
}

function ReviewContent() {
  const questionRepository = useMemo(() => new JsonQuestionRepository(getSelectedCertId()), []);
  const [tab, setTab] = useState<Tab>("wrong");
  const [phase, setPhase] = useState<Phase>({ kind: "list" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [wrongNotesById, setWrongNotesById] = useState<Map<string, WrongNote>>(new Map());
  const [modeById, setModeById] = useState<Map<string, Mode>>(new Map());
  const searchParams = useSearchParams();
  const [modeFilter, setModeFilter] = useState<"all" | "study" | "exam">(() => {
    const m = searchParams.get("mode");
    return m === "study" || m === "exam" ? m : "all";
  });
  const [roundFilter, setRoundFilter] = useState<string>(() => searchParams.get("examId") ?? "all");
  const sessionIdFilter = searchParams.get("sessionId");
  const [subjectFilter, setSubjectFilter] = useState<string>(() => searchParams.get("subject") ?? "all");
  const requestKey = `${tab}|${modeFilter}|${roundFilter}|${sessionIdFilter ?? ""}`;
  // `loadedTab` (rather than a `loading` boolean flipped via effect) lets `loading` be
  // derived during render instead of set synchronously inside useEffect, which
  // react-hooks/set-state-in-effect disallows even through an intermediate async call.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const latestRequestId = useRef(0);
  const loading = loadedKey !== requestKey;

  const availableRounds =
    tab === "wrong"
      ? [
          ...new Set(
            questions
              .map((q) => tryParseQuestionId(q.questionId)?.examId)
              .filter((examId): examId is string => examId !== undefined)
          ),
        ].sort((a, b) => b.localeCompare(a))
      : [];

  const availableSubjects =
    tab === "wrong"
      ? [...new Map(questions.map((q) => [q.subject, q.subjectName] as const)).entries()]
          .map(([subject, subjectName]) => ({ subject, subjectName }))
          .sort((a, b) => a.subject - b.subject)
      : [];

  // URL(오래된 북마크 등)로 들어온 과목값이 이 자격증엔 없는 과목번호일 수 있다 —
  // 그 경우 빈 목록으로 조용히 실패하는 대신 "전체 과목"으로 취급한다.
  const effectiveSubjectFilter = availableSubjects.some((s) => String(s.subject) === subjectFilter)
    ? subjectFilter
    : "all";

  const filteredQuestions =
    tab === "wrong"
      ? questions.filter((q) => {
          const note = wrongNotesById.get(q.questionId);
          if (modeFilter !== "all" && note?.mode !== modeFilter) return false;
          if (roundFilter !== "all" && tryParseQuestionId(q.questionId)?.examId !== roundFilter) return false;
          if (effectiveSubjectFilter !== "all" && String(q.subject) !== effectiveSubjectFilter) return false;
          return true;
        })
      : questions;

  // Reusable for imperative reloads (e.g. the "복습 목록으로" button) — never referenced
  // from the effect below, since react-hooks/set-state-in-effect flags any effect that
  // captures a function which itself calls a state setter, however deep.
  function loadTab(nextTab: Tab) {
    const requestId = ++latestRequestId.current;
    fetchTabQuestions(questionRepository, nextTab, modeFilter, roundFilter, sessionIdFilter).then(
      ({ questions: hydrated, wrongNotesById: notes, modeById: modes }) => {
        if (requestId !== latestRequestId.current) return;
        setQuestions(hydrated);
        setWrongNotesById(notes);
        setModeById(modes);
        setLoadedKey(`${nextTab}|${modeFilter}|${roundFilter}|${sessionIdFilter ?? ""}`);
      },
      (err) => {
        if (requestId !== latestRequestId.current) return;
        console.error("loadTab failed:", err);
        setQuestions([]);
        setWrongNotesById(new Map());
        setModeById(new Map());
        setLoadedKey(`${nextTab}|${modeFilter}|${roundFilter}|${sessionIdFilter ?? ""}`);
      }
    );
  }

  useEffect(() => {
    const requestId = ++latestRequestId.current;
    fetchTabQuestions(questionRepository, tab, modeFilter, roundFilter, sessionIdFilter).then(
      ({ questions: hydrated, wrongNotesById: notes, modeById: modes }) => {
        if (requestId !== latestRequestId.current) return;
        setQuestions(hydrated);
        setWrongNotesById(notes);
        setModeById(modes);
        setLoadedKey(requestKey);
      },
      (err) => {
        if (requestId !== latestRequestId.current) return;
        console.error("loadTab failed:", err);
        setQuestions([]);
        setWrongNotesById(new Map());
        setModeById(new Map());
        setLoadedKey(requestKey);
      }
    );
  }, [tab, questionRepository, modeFilter, roundFilter, sessionIdFilter, requestKey]);

  async function handleRemove(questionId: string) {
    const removingFromTab = tab;
    const requestId = ++latestRequestId.current;

    try {
      if (removingFromTab === "wrong") {
        await progressRepository.removeWrongNote(questionId);
      } else if (removingFromTab === "favorite") {
        await progressRepository.removeFavorite(questionId);
      }
    } catch (err) {
      console.error("removeWrongNote/removeFavorite failed:", err);
      return; // 삭제가 실패했으면 화면에서도 안 지운다 — DB에 그대로 남아있으니 목록도 그래야 맞다.
    }

    // 삭제가 끝나기 전에 사용자가 다른 탭으로 전환했으면, 지금 화면엔 그 탭의 문항이
    // 떠 있으므로 여기서 필터링하면 안 된다 — DB는 이미 정확히 지워졌고, 화면 반영은
    // 다음 탭 로드(loadTab)가 최신 상태로 알아서 채운다.
    if (tab !== removingFromTab || requestId !== latestRequestId.current) return;
    setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  }

  async function handleRetry(selectedQuestions: Question[]) {
    if (selectedQuestions.length === 0) return;
    try {
      const [theoryMap, settings] = await Promise.all([
        questionRepository.getTheoryMap(),
        settingsRepository.getSettings().catch(() => DEFAULT_SETTINGS),
      ]);
      const orderedQuestions =
        settings.reviewOrder === "random"
          ? pickRandomQuestions(selectedQuestions, selectedQuestions.length)
          : selectedQuestions;
      setPhase({
        kind: "active",
        questions: orderedQuestions,
        theoryMap,
        autoSaveWrongNotes: settings.autoSaveWrongNotes,
      });
    } catch {
      setPhase({ kind: "error", message: "관련 이론 데이터를 불러오지 못했다. 다시 시도해달라." });
    }
  }

  if (phase.kind === "error") {
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium text-red-700">{phase.message}</p>
        <button
          type="button"
          onClick={() => setPhase({ kind: "list" })}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          목록으로
        </button>
      </div>
    );
  }

  if (phase.kind === "done") {
    const { total, solved, correct, wrong } = phase.summary;
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">복습 완료.</p>
        <p className="text-gray-600">
          {total}문제 중 {solved}문제 풀이 — 정답 {correct} · 오답 {wrong}
        </p>
        <button
          type="button"
          onClick={() => {
            setPhase({ kind: "list" });
            loadTab(tab);
          }}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          복습 목록으로
        </button>
      </div>
    );
  }

  if (phase.kind === "active") {
    return (
      <PracticeSession
        questions={phase.questions}
        theoryMap={phase.theoryMap}
        mode="study"
        entryType="random"
        timeLimitMs={null}
        autoSaveWrongNotes={phase.autoSaveWrongNotes}
        onFinish={(summary) => setPhase({ kind: "done", summary })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-xl mx-auto w-full flex gap-2 px-6 pt-6">
        {(["wrong", "favorite", "recent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded border ${tab === t ? "bg-black text-white" : ""}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "wrong" && (
        <div className="max-w-xl mx-auto w-full flex gap-2 px-6">
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as "all" | "study" | "exam")}
            className="px-2 py-1.5 rounded border text-sm"
          >
            <option value="all">전체 모드</option>
            <option value="study">학습모드</option>
            <option value="exam">시험모드</option>
          </select>
          <select
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="px-2 py-1.5 rounded border text-sm"
          >
            <option value="all">전체 회차</option>
            {availableRounds.map((examId) => (
              <option key={examId} value={examId}>
                {examId}
              </option>
            ))}
          </select>
          <select
            value={effectiveSubjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-2 py-1.5 rounded border text-sm"
          >
            <option value="all">전체 과목</option>
            {availableSubjects.map(({ subject, subjectName }) => (
              <option key={subject} value={subject}>
                {getSubjectLabel({ subject, subjectName })}
              </option>
            ))}
          </select>
        </div>
      )}
      {loading ? (
        <p className="text-center p-10">불러오는 중...</p>
      ) : (
        <ReviewList
          questions={filteredQuestions}
          emptyMessage={EMPTY_MESSAGE[tab]}
          onRemove={tab === "recent" ? undefined : handleRemove}
          onRetry={handleRetry}
          metaFor={(question) => {
            const id = question.questionId;
            const examId = tryParseQuestionId(id)?.examId;
            const mode = tab === "wrong" ? wrongNotesById.get(id)?.mode : modeById.get(id);
            const modeLabel = mode === "exam" ? "시험모드" : mode === "study" ? "학습모드" : null;
            const subjectLabel = getSubjectLabel(question);

            if (tab === "wrong") {
              const note = wrongNotesById.get(id);
              if (!note) return null;
              const date = new Date(note.addedAt).toLocaleDateString("ko-KR");
              const rest = [examId, modeLabel, subjectLabel].filter(Boolean).join(" · ");
              return rest ? `${date} · ${rest}` : date;
            }
            const rest = [examId, modeLabel, subjectLabel].filter(Boolean).join(" · ");
            return rest || null;
          }}
        />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<p className="text-center p-10">불러오는 중...</p>}>
      <ReviewContent />
    </Suspense>
  );
}
