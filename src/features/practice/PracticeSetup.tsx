"use client";

import { useEffect, useRef, useState } from "react";
import { computeExamStatuses, type ExamStatus } from "@/lib/examStatus";
import { getSubjectLabel } from "@/lib/theory";
import { computeExamTimeLimitMs } from "@/lib/examTimeLimit";
import type { QuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Mode } from "@/types/progress";
import type { ExamSummary } from "@/types/question";

export type PracticeSetupValue =
  | {
      mode: Mode;
      entryType: "random";
      subject: number | "all";
      // 지정되면 subject 대신 이 회차들(SQLD 노랭이 N-N과목처럼 과목번호가
      // 뭉뚱그려진 자격증)로 풀을 제한한다.
      examIds?: string[];
      count: number;
      order: "random" | "sequential";
      timeLimitMs: number | null;
    }
  | { mode: Mode; entryType: "round"; examId: string; timeLimitMs: number | null };

interface PracticeSetupProps {
  questionRepository: QuestionRepository;
  certId: string;
  onStart: (value: PracticeSetupValue) => void;
  initialEntryType?: "random" | "round";
  initialMode?: Mode;
  initialSubject?: number | "all";
  initialCount?: number;
}

const progressRepository = new IndexedDbProgressRepository();

const STATUS_STYLE: Record<ExamStatus, string> = {
  미응시: "text-gray-400",
  진행중: "text-blue-600",
  완료: "text-green-600",
};

// 자격증별 실제 시험 문항수를 기준으로 한 랜덤모드 문항수 선택지 — 정처기는
// 100문항 시험의 20%/40%/100%, SQLD는 50문항 시험의 20%/40%/100%에 대응한다.
const COUNT_OPTIONS: Record<string, number[]> = {
  jcg: [20, 40, 100, Infinity],
  sqld: [10, 25, 50, Infinity],
};

// SQLD의 "노랭이 N-N과목" 원본 문제집 — 과목번호가 1/2로만 뭉뚱그려져 있어
// 과목별 진입의 "과목" 선택지는 이 회차 단위로 대신 보여준다.
const SQLD_TOPIC_SET_PATTERN = /^SQLD-\d-\d$/;
// SQLD 기출복원 회차(SQLD-48~SQLD-58처럼 숫자 하나로만 된 examId)
const SQLD_ROUND_PATTERN = /^SQLD-(\d+)$/;

// 회차별 목록에 보여줄 순서 — 정처기는 파일 순서가 오래된 것부터라 최신이
// 먼저 보이도록 뒤집는다. SQLD는 기출복원 회차를 최신(숫자 큰 순)이 맨
// 위로 오도록 정렬하고, 노랭이(주제별 원본 문제집)는 맨 아래로 보낸다.
// 이 순서의 첫 항목을 회차별 기본 선택값으로도 쓴다.
export function getOrderedVisibleExams(examList: ExamSummary[], certId: string): ExamSummary[] {
  if (certId === "jcg") return [...examList].reverse();
  if (certId !== "sqld") return examList;

  const rounds = examList
    .filter((exam) => SQLD_ROUND_PATTERN.test(exam.examId))
    .sort((a, b) => Number(b.examId.match(SQLD_ROUND_PATTERN)![1]) - Number(a.examId.match(SQLD_ROUND_PATTERN)![1]));
  const topicSets = examList.filter((exam) => SQLD_TOPIC_SET_PATTERN.test(exam.examId));
  const rest = examList.filter(
    (exam) => !SQLD_ROUND_PATTERN.test(exam.examId) && !SQLD_TOPIC_SET_PATTERN.test(exam.examId)
  );
  return [...rounds, ...rest, ...topicSets];
}

export function PracticeSetup({
  questionRepository,
  certId,
  onStart,
  initialEntryType,
  initialMode,
  initialSubject,
  initialCount,
}: PracticeSetupProps) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "study");
  const [timeLimitMode, setTimeLimitMode] = useState<"auto" | "none">(initialMode === "exam" ? "auto" : "none");
  const [entryType, setEntryType] = useState<"random" | "round">(initialEntryType ?? "random");
  const [subject, setSubject] = useState<number | "all">(initialSubject ?? "all");
  const [topicExamId, setTopicExamId] = useState<string | "all">("all");
  const [order, setOrder] = useState<"random" | "sequential">("sequential");
  const countOptions = COUNT_OPTIONS[certId] ?? COUNT_OPTIONS.jcg;
  const [count, setCount] = useState<number>(initialCount ?? Infinity);
  const [examId, setExamId] = useState<string | null>(null);
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ExamStatus>>(new Map());
  const [subjects, setSubjects] = useState<{ subject: number; subjectName?: string }[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<Map<number | "all", number>>(new Map());
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const selectedExamRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    Promise.all([questionRepository.getExamIndex(), progressRepository.getAttempts()]).then(
      ([examList, attempts]) => {
        setExams(examList);
        setStatuses(computeExamStatuses(examList, attempts));
        // 회차별 기본값 — 목록 맨 위(정처기는 최신 회차, SQLD는 실전모의고사 1회)를 미리 골라둔다.
        const ordered = getOrderedVisibleExams(examList, certId);
        setExamId((prev) => prev ?? ordered[0]?.examId ?? prev);
      },
      (err) => {
        console.error("회차 목록을 불러오지 못했다:", err);
        setExams([]);
      }
    );

    // 과목 버튼 목록만을 위해 전체 문항을 내려받는다 — 회차 목록·상태 표시는 위
    // 요청과 분리해서 이걸 기다리지 않고 먼저 뜨게 한다(전체 문항 fetch는 자격증
    // 회차가 많을수록 오래 걸릴 수 있다). 여기서 채운 캐시는 "시작" 시 재사용된다.
    questionRepository.getQuestions({}).then(
      (allQuestions) => {
        const subjectList = [...new Map(allQuestions.map((q) => [q.subject, q.subjectName] as const)).entries()]
          .map(([subject, subjectName]) => ({ subject, subjectName }))
          .sort((a, b) => a.subject - b.subject);
        setSubjects(subjectList);
        // URL(예: 오래된 북마크)로 들어온 초기 과목값이 이 자격증엔 없는 과목번호일
        // 수 있다 — 그 경우 빈 문항 목록으로 조용히 실패하는 대신 "통합"으로 되돌린다.
        setSubject((prev) => (prev === "all" || subjectList.some((s) => s.subject === prev) ? prev : "all"));

        // 문항수 "전체" 선택 시 제한시간 자동계산에 실제 문항수를 쓰기 위해 세어둔다.
        const counts = new Map<number | "all", number>([["all", allQuestions.length]]);
        for (const q of allQuestions) counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
        setSubjectCounts(counts);
        setQuestionsLoaded(true);
      },
      (err) => {
        // questionsLoaded를 켜지 않는다 — 실패한 채로 켜면 subjectCounts가 빈
        // 상태로 "로딩 끝남" 취급돼 제한시간 자동계산이 0으로 나와 시작하자마자
        // 자동제출되는 문제로 이어진다(회차별이 examId를 계속 null로 둬 시작을
        // 막는 것과 동일하게, 여기서도 계산할 수 있을 때까지 시작을 막아둔다).
        console.error("과목 목록을 불러오지 못했다:", err);
      }
    );
  }, [questionRepository, certId]);

  // 회차별 기본값이 목록 맨 아래쪽에 있을 수 있어 스크롤해야 보인다 — 기본
  // 진입방식이 "과목별"이라 exams가 로드될 때는 회차 버튼이 아직 안 그려져
  // 있을 수 있다. entryType을 의존성에 넣어서 나중에 "회차별"로 전환해도
  // (그때 버튼이 그려지면) 다시 스크롤되게 한다.
  useEffect(() => {
    selectedExamRef.current?.scrollIntoView({ block: "nearest" });
  }, [exams, entryType]);

  // SQLD는 과목번호가 1/2로만 뭉뚱그려져 있어 "과목" 선택지를 노랭이 N-N과목
  // 회차 단위로 대신 보여준다(과목번호 기반 selector는 정처기 전용으로 둔다).
  const sqldTopicExams = certId === "sqld" ? (exams?.filter((e) => SQLD_TOPIC_SET_PATTERN.test(e.examId)) ?? []) : [];
  const usesTopicExams = certId === "sqld";

  // 제한시간 값 자체는 사용자가 고르지 않는다 — 자격증별 실제 시험의 문항당 배정
  // 시간 비율로 항상 자동 계산한다(회차별은 그 회차의 실제 문항수 기준). 다만
  // 시험모드에서 그 자동값을 적용할지, 아예 제한없음으로 풀지는 고를 수 있다.
  const roundQuestionCount = examId ? (exams?.find((e) => e.examId === examId)?.count ?? 0) : 0;
  // "전체"(Infinity)를 고르면 실제로 뽑히는 문항수(과목/회차 필터 반영)로 계산한다.
  const topicQuestionCount =
    topicExamId === "all"
      ? sqldTopicExams.reduce((sum, e) => sum + e.count, 0)
      : (exams?.find((e) => e.examId === topicExamId)?.count ?? 0);
  const randomQuestionCount =
    count === Infinity
      ? usesTopicExams
        ? topicQuestionCount
        : (subjectCounts.get(subject) ?? 0)
      : count;
  const autoTimeLimitMs =
    mode === "exam"
      ? computeExamTimeLimitMs(certId, entryType === "round" ? roundQuestionCount : randomQuestionCount)
      : null;
  const timeLimitMs = timeLimitMode === "auto" ? autoTimeLimitMs : null;

  function handleStart() {
    if (entryType === "round") {
      if (!examId) return;
      onStart({ mode, entryType: "round", examId, timeLimitMs });
    } else if (usesTopicExams) {
      const examIds = topicExamId === "all" ? sqldTopicExams.map((e) => e.examId) : [topicExamId];
      onStart({
        mode,
        entryType: "random",
        subject: "all",
        examIds,
        count,
        order,
        timeLimitMs,
      });
    } else {
      onStart({
        mode,
        entryType: "random",
        subject,
        count,
        order,
        timeLimitMs,
      });
    }
  }

  // 과목별 진입은 exams(SQLD 과목별 회차목록)·questionsLoaded(문항수/제한시간 계산용)가
  // 아직 안 불러와진 상태로 시작하면 빈 풀 오류(SQLD)나 제한시간 0으로 즉시
  // 자동제출(시험모드+자동)로 이어질 수 있어, 로딩 끝나기 전엔 시작을 막는다.
  const dataLoading = exams === null || !questionsLoaded;
  const startDisabled = (entryType === "round" && !examId) || (entryType === "random" && dataLoading);

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">문제풀이</h1>

      <div className="flex flex-col gap-2">
        <span className="font-medium">모드</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("study")}
            className={`px-3 py-1.5 rounded border ${mode === "study" ? "bg-black text-white" : ""}`}
          >
            학습모드
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("exam");
              setTimeLimitMode("auto");
            }}
            className={`px-3 py-1.5 rounded border ${mode === "exam" ? "bg-black text-white" : ""}`}
          >
            시험모드
          </button>
        </div>
      </div>

      {mode === "exam" && (
        <div className="flex flex-col gap-2">
          <span className="font-medium">제한시간</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTimeLimitMode("none")}
              className={`px-3 py-1.5 rounded border ${timeLimitMode === "none" ? "bg-black text-white" : ""}`}
            >
              제한없음
            </button>
            <button
              type="button"
              onClick={() => setTimeLimitMode("auto")}
              className={`px-3 py-1.5 rounded border ${timeLimitMode === "auto" ? "bg-black text-white" : ""}`}
            >
              {autoTimeLimitMs
                ? `${Math.round(autoTimeLimitMs / 60000)}분`
                : entryType === "round" && !examId
                  ? "자동"
                  : "-"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-medium">순서</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrder("sequential")}
            className={`px-3 py-1.5 rounded border ${order === "sequential" ? "bg-black text-white" : ""}`}
          >
            순차
          </button>
          <button
            type="button"
            onClick={() => setOrder("random")}
            className={`px-3 py-1.5 rounded border ${order === "random" ? "bg-black text-white" : ""}`}
          >
            랜덤
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">범위</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEntryType("random")}
            className={`px-3 py-1.5 rounded border ${entryType === "random" ? "bg-black text-white" : ""}`}
          >
            과목별
          </button>
          <button
            type="button"
            onClick={() => setEntryType("round")}
            className={`px-3 py-1.5 rounded border ${entryType === "round" ? "bg-black text-white" : ""}`}
          >
            회차별
          </button>
        </div>
      </div>

      {entryType === "random" ? (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              {usesTopicExams ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTopicExamId("all")}
                    className={`px-3 py-1.5 rounded border ${topicExamId === "all" ? "bg-black text-white" : ""}`}
                  >
                    통합
                  </button>
                  {sqldTopicExams.map((exam) => (
                    <button
                      key={exam.examId}
                      type="button"
                      onClick={() => setTopicExamId(exam.examId)}
                      className={`px-3 py-1.5 rounded border ${topicExamId === exam.examId ? "bg-black text-white" : ""}`}
                    >
                      {exam.title}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSubject("all")}
                    className={`px-3 py-1.5 rounded border ${subject === "all" ? "bg-black text-white" : ""}`}
                  >
                    통합
                  </button>
                  {subjects.map(({ subject: num, subjectName }) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSubject(num)}
                      className={`px-3 py-1.5 rounded border ${subject === num ? "bg-black text-white" : ""}`}
                    >
                      {getSubjectLabel({ subject: num, subjectName })}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-medium">문항수</span>
            <div className="flex gap-2">
              {countOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded border ${count === n ? "bg-black text-white" : ""}`}
                >
                  {n === Infinity ? "전체" : n}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {exams === null ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {getOrderedVisibleExams(exams, certId).map((exam) => {
                const status = statuses.get(exam.examId) ?? "미응시";
                return (
                  <button
                    key={exam.examId}
                    ref={examId === exam.examId ? selectedExamRef : undefined}
                    type="button"
                    onClick={() => setExamId(exam.examId)}
                    className={`flex justify-between gap-2 px-3 py-1.5 rounded border ${examId === exam.examId ? "bg-black text-white" : ""}`}
                  >
                    <span>{exam.title}</span>
                    <span className={examId === exam.examId ? "" : STATUS_STYLE[status]}>
                      {status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {entryType === "random" && dataLoading && (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={startDisabled}
        className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        시작
      </button>
    </div>
  );
}
