# 복습 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오답노트·즐겨찾기·최근 푼 문제 3개 탭으로 구성된 복습 화면을 끝까지 동작하게 만든다 — 목록 조회 → 개별 제거 → 전체 다시 풀기(학습모드 재사용) → 결과 요약까지.

**Architecture:** 학습모드 문제풀이 계획(`docs/superpowers/plans/2026-07-30-practice-mvp-foundation.md`)이 만든 `PracticeSession`/`QuestionCard`/`ProgressRepository`/`QuestionRepository`를 그대로 재사용한다. 새 화면은 그 위에 조회·삭제 기능만 얹는다.

**Tech Stack:** 기존과 동일 — Next.js 16 / React 19 / TypeScript / Tailwind CSS 4 / Vitest / `idb`

## Scope 결정 (사전 조사 결과)

설계문서 2절: 복습 메뉴 Phase 1 범위는 "오답노트, 즐겨찾기, 틀린 문제 다시 풀기, 최근 푼 문제 다시 풀기" — SRS·Priority·자동 복습 큐·망각곡선은 Phase 2. 이 계획은 그 4개 항목만 만든다.

**사전 조사에서 찾은 진짜 문제 (계획 단계 필수 반영)**:
1. **`ProgressRepository`에 조회 메서드가 없다.** 학습모드 계획이 고정한 인터페이스는 `addWrongNote`/`addFavorite`(쓰기)만 있고 `getWrongNotes`/`getFavorites`(읽기), 제거 메서드가 아예 없다 — 복습 화면은 원래 인터페이스만으로 만들 수 없다. Task 1에서 인터페이스를 확장한다(기존 메서드 시그니처는 안 건드림, 추가만).
2. **즐겨찾기를 추가할 UI 자체가 없다.** `addFavorite`를 부르는 곳이 코드베이스 전체에 0곳(`grep` 확인) — 지금 상태로 복습 화면을 만들어도 즐겨찾기 탭은 영원히 빈 채로 남는다. Task 4에서 학습모드 화면(`QuestionCard`/`PracticeSession`)에 즐겨찾기 버튼을 추가한다.
3. **`theory_map.json` 직접 fetch 문제(이전 최종 리뷰에서 이월 보류됐던 것)를 이번에 해소한다.** `app/practice/page.tsx`가 Repository를 안 거치고 `fetch("/data/theory_map.json")`을 직접 호출하던 걸 이번 계획의 새 화면(`app/review/page.tsx`)도 그대로 필요로 하게 되는데, 두 번째 소비자가 생기는 시점이 바로 지금이다. `QuestionRepository.getTheoryMap()`으로 승격해 두 화면이 공유·캐싱한다(Task 1).

**의도적으로 이번에 안 하는 것**:
- 오답 재도전 성공 시 오답노트 자동 제거("졸업" 판정) — SRS/Priority 영역이라 Phase 2. 이번엔 사용자가 "제거" 버튼을 직접 눌러야 목록에서 빠진다.
- 개별 문항 단위 "다시 풀기"(리스트 아이템 하나만 재도전) — 설계문서 문구가 "다시 풀기"를 세트 단위로만 표현하므로 목록 전체 재도전(`전체 다시 풀기`)만 만든다.
- 학습모드에서 이미 즐겨찾기한 문항의 해제(unfavorite) — 추가는 학습모드에서, 제거는 복습 화면에서만 가능(왕복 토글은 다음 계획).
- 최근 푼 문제 탭의 "제거" — 이 탭은 `Attempt` 로그에서 파생된 뷰라 저장소 자체가 없다. 지울 대상이 없으므로 제거 버튼도 없다.

## Global Constraints

- 설계문서 4절 원칙 8번: 모든 비즈니스 로직은 순수 함수로, UI·Repository에 직접 의존하지 않는다.
- 설계문서 8절: `/lib`의 순수 함수만 Vitest로 테스트한다. UI 컴포넌트 자동 테스트는 Phase 1 범위 밖 — 수동 QA로 대체.
- `ProgressRepository`/`QuestionRepository`의 **기존** 메서드 시그니처는 절대 변경하지 않는다(학습모드 화면이 이미 소비 중) — 이번 계획은 확장만 한다.
- `Question.answer: number | number[]`(복수정답) 처리는 `PracticeSession`/`QuestionCard`가 이미 담당 — 이 계획에서 재구현하지 않는다, 그대로 재사용.
- `QuestionCard`는 "표시만 담당, 내부 상태 없음" 원칙을 유지한다(학습모드 최종 리뷰에서 확인된 강점) — 즐겨찾기 클릭 후 상태(이미 눌렀는지)는 부모(`PracticeSession`)가 들고 `isFavorited` prop으로 내려준다.

---

## 파일 구조

```text
src/types/progress.ts                 WrongNote, Favorite 타입 추가 (기존 Attempt/QuestionStats/DashboardSummary 유지)
src/lib/recentlySolved.ts             getRecentlySolvedQuestionIds (신규, 순수 함수)

src/repositories/QuestionRepository.ts    getTheoryMap 추가
src/repositories/ProgressRepository.ts    getWrongNotes/getFavorites/removeWrongNote/removeFavorite 추가

src/features/practice/QuestionCard.tsx     즐겨찾기 버튼 추가
src/features/practice/PracticeSession.tsx  즐겨찾기 상태·핸들러 추가

src/features/review/ReviewList.tsx    신규 — 목록 표시 + 제거 + 전체 다시 풀기
src/app/review/page.tsx               신규 — 탭 3개 + 목록/재도전/완료 phase
src/app/page.tsx                      "복습" 진입 링크 추가 (수정)
```

---

### Task 1: `getTheoryMap` (QuestionRepository) + `WrongNote`/`Favorite` 조회·제거 (ProgressRepository)

**Files:**
- Modify: `src/repositories/QuestionRepository.ts`
- Modify: `src/repositories/QuestionRepository.test.ts`
- Modify: `src/app/practice/page.tsx`
- Modify: `src/types/progress.ts`
- Modify: `src/repositories/ProgressRepository.ts`
- Modify: `src/repositories/ProgressRepository.test.ts`

**Interfaces:**
- Produces:
  - `QuestionRepository.getTheoryMap(): Promise<TheoryMap>`
  - `interface WrongNote { questionId: string; addedAt: number }`
  - `interface Favorite { questionId: string; addedAt: number }`
  - `ProgressRepository.getWrongNotes(): Promise<WrongNote[]>`
  - `ProgressRepository.getFavorites(): Promise<Favorite[]>`
  - `ProgressRepository.removeWrongNote(questionId: string): Promise<void>`
  - `ProgressRepository.removeFavorite(questionId: string): Promise<void>`

- [ ] **Step 1: `src/types/progress.ts`에 타입 추가**

```ts
export type Mode = "exam" | "study";

export interface Attempt {
  id?: number;
  questionId: string;
  solvedAt: number;
  mode: Mode;
  selectedAnswer: number;
  isCorrect: boolean;
  solveTimeMs: number;
}

export interface QuestionStats {
  questionId: string;
  correctCount: number;
  wrongCount: number;
  lastSolvedAt: number;
}

export interface DashboardSummary {
  todayCount: number;
  todayAccuracy: number;
  totalCount: number;
  totalAccuracy: number;
}

export interface WrongNote {
  questionId: string;
  addedAt: number;
}

export interface Favorite {
  questionId: string;
  addedAt: number;
}
```

(기존 4개는 그대로 두고 `WrongNote`/`Favorite` 두 개만 새로 추가한다.)

- [ ] **Step 2: 실패하는 테스트 작성 — `QuestionRepository.test.ts`에 `getTheoryMap` 케이스 추가**

파일 맨 위 fixture 영역에 `theoryMapFixture`를 추가하고, `mockFetchJson`이 `theory_map` URL도 분기하도록 고친 뒤, 테스트 3개를 `describe("JsonQuestionRepository")` 블록 끝에 추가한다.

```ts
// mockFetchJson 함수 교체
const theoryMapFixture = {
  "075": { tag: null, name: "스택(Stack)", page: 25, subject: "2과목 소프트웨어 개발" },
};

function mockFetchJson(url: string) {
  const body = url.includes("exams_index")
    ? examsIndexFixture
    : url.includes("theory_map")
      ? theoryMapFixture
      : url.includes("exam_2023-1")
        ? exam2023_1
        : exam2023_2;
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}
```

`describe` 블록 끝(마지막 `it` 다음)에 추가:

```ts
  it("getTheoryMap은 /data/theory_map.json을 fetch해서 반환한다", async () => {
    const repo = new JsonQuestionRepository();
    const map = await repo.getTheoryMap();
    expect(map["075"].name).toBe("스택(Stack)");
    expect(fetch).toHaveBeenCalledWith("/data/theory_map.json");
  });

  it("getTheoryMap을 두 번 불러도 fetch는 한 번만 일어난다 (캐시)", async () => {
    const repo = new JsonQuestionRepository();
    await repo.getTheoryMap();
    await repo.getTheoryMap();
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("theory_map")
    );
    expect(calls).toHaveLength(1);
  });

  it("getTheoryMap의 fetch가 실패해도 캐시에 남지 않아 재시도 시 다시 fetch한다", async () => {
    const repo = new JsonQuestionRepository();
    const mockFetch = vi.fn(mockFetchJson);
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(repo.getTheoryMap()).rejects.toThrow("network error");

    const map = await repo.getTheoryMap();
    expect(map["075"].name).toBe("스택(Stack)");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npx vitest run src/repositories/QuestionRepository.test.ts
```

Expected: FAIL — `repo.getTheoryMap is not a function`

- [ ] **Step 4: 구현 — `QuestionRepository.ts`에 `getTheoryMap` 추가**

인터페이스와 클래스 양쪽에 추가한다. `loadIndex`와 완전히 같은 캐싱 패턴(거부 시 캐시 비우고 rethrow)을 따른다.

```ts
import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import type { ExamSummary, Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

export interface QuestionRepository {
  getQuestion(questionId: string): Promise<Question>;
  getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]>;
  getTheoryMap(): Promise<TheoryMap>;
}
```

`JsonQuestionRepository` 클래스에 필드와 메서드 추가(기존 `examCache`/`indexCache` 옆에):

```ts
  private theoryMapCache: Promise<TheoryMap> | null = null;

  async getTheoryMap(): Promise<TheoryMap> {
    if (!this.theoryMapCache) {
      this.theoryMapCache = fetch("/data/theory_map.json")
        .then((res) => res.json() as Promise<TheoryMap>)
        .catch((err) => {
          this.theoryMapCache = null;
          throw err;
        });
    }
    return this.theoryMapCache;
  }
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/repositories/QuestionRepository.test.ts
```

Expected: PASS (8 tests — 기존 5개 + 신규 3개)

- [ ] **Step 6: `app/practice/page.tsx`가 직접 fetch 대신 `getTheoryMap()`을 쓰도록 수정**

```ts
const [pool, theoryMap] = await Promise.all([
  questionRepository.getQuestions(
    value.subject === "all" ? {} : { subject: value.subject }
  ),
  questionRepository.getTheoryMap(),
]);
```

(기존 `fetch("/data/theory_map.json").then(...)` 줄을 지우고 위로 교체. `TheoryMap` import는 더 이상 `page.tsx`에서 직접 안 써도 되면 지운다 — `Phase` 타입 선언에서 여전히 쓰므로 import는 유지.)

- [ ] **Step 7: 실패하는 테스트 작성 — `ProgressRepository.test.ts`에 조회/제거 케이스 추가**

`describe` 블록의 "addWrongNote / addFavorite는 questionId를 저장한다" 테스트 바로 뒤에 추가:

```ts
  it("getWrongNotes / getFavorites는 추가한 항목을 전부 반환한다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1");
    await repo.addWrongNote("Q2");
    await repo.addFavorite("Q3");

    const wrongNotes = await repo.getWrongNotes();
    const favorites = await repo.getFavorites();

    expect(wrongNotes.map((n) => n.questionId).sort()).toEqual(["Q1", "Q2"]);
    expect(favorites.map((n) => n.questionId)).toEqual(["Q3"]);
  });

  it("아무것도 추가 안 했으면 getWrongNotes / getFavorites는 빈 배열", async () => {
    const repo = new IndexedDbProgressRepository();
    expect(await repo.getWrongNotes()).toEqual([]);
    expect(await repo.getFavorites()).toEqual([]);
  });

  it("removeWrongNote / removeFavorite는 해당 항목만 지운다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1");
    await repo.addWrongNote("Q2");
    await repo.addFavorite("Q3");

    await repo.removeWrongNote("Q1");
    await repo.removeFavorite("Q3");

    expect((await repo.getWrongNotes()).map((n) => n.questionId)).toEqual(["Q2"]);
    expect(await repo.getFavorites()).toEqual([]);
  });

  it("같은 questionId를 두 번 addWrongNote해도 중복 저장되지 않는다 (upsert)", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("Q1");
    await repo.addWrongNote("Q1");
    expect(await repo.getWrongNotes()).toHaveLength(1);
  });
```

- [ ] **Step 8: 테스트 실패 확인**

```bash
npx vitest run src/repositories/ProgressRepository.test.ts
```

Expected: FAIL — `repo.getWrongNotes is not a function`

- [ ] **Step 9: 구현 — `ProgressRepository.ts`에 조회·제거 메서드 추가**

인터페이스에 추가:

```ts
import { getDb } from "./db";
import { isSameLocalDay } from "@/lib/timer";
import type { Attempt, DashboardSummary, Favorite, QuestionStats, WrongNote } from "@/types/progress";

export interface ProgressRepository {
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(questionId?: string): Promise<Attempt[]>;
  getQuestionStats(questionId: string): Promise<QuestionStats>;
  getDashboardSummary(): Promise<DashboardSummary>;
  addWrongNote(questionId: string): Promise<void>;
  addFavorite(questionId: string): Promise<void>;
  getWrongNotes(): Promise<WrongNote[]>;
  getFavorites(): Promise<Favorite[]>;
  removeWrongNote(questionId: string): Promise<void>;
  removeFavorite(questionId: string): Promise<void>;
}
```

클래스에 메서드 추가(기존 `addWrongNote`/`addFavorite` 아래):

```ts
  async getWrongNotes(): Promise<WrongNote[]> {
    const db = await getDb();
    return db.getAll("wrongNotes");
  }

  async getFavorites(): Promise<Favorite[]> {
    const db = await getDb();
    return db.getAll("favorites");
  }

  async removeWrongNote(questionId: string): Promise<void> {
    const db = await getDb();
    await db.delete("wrongNotes", questionId);
  }

  async removeFavorite(questionId: string): Promise<void> {
    const db = await getDb();
    await db.delete("favorites", questionId);
  }
```

`db.ts`는 수정하지 않는다 — `wrongNotes`/`favorites` 스토어와 `keyPath: "questionId"`는 이미 있고, `getAll`/`delete`는 idb가 스키마만 있으면 바로 쓸 수 있다.

- [ ] **Step 10: 테스트 통과 확인**

```bash
npx vitest run src/repositories/ProgressRepository.test.ts
```

Expected: PASS (9 tests — 기존 5개 + 신규 4개)

- [ ] **Step 11: 전체 확인**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: 전체 통과, `/practice`·`/` 라우트 정상.

- [ ] **Step 12: Commit**

```bash
git add src/types/progress.ts src/repositories/QuestionRepository.ts src/repositories/QuestionRepository.test.ts src/repositories/ProgressRepository.ts src/repositories/ProgressRepository.test.ts src/app/practice/page.tsx
git commit -m "feat: theory_map 캐싱 Repository로 승격 + 오답노트/즐겨찾기 조회·제거 API"
```

---

### Task 2: 최근 푼 문제 추출 (순수 함수)

**Files:**
- Create: `src/lib/recentlySolved.ts`
- Create: `src/lib/recentlySolved.test.ts`

**Interfaces:**
- Consumes: `Attempt` (`src/types/progress.ts`, Task 1)
- Produces: `getRecentlySolvedQuestionIds(attempts: Attempt[], limit: number): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { getRecentlySolvedQuestionIds } from "./recentlySolved";
import type { Attempt } from "@/types/progress";

function makeAttempt(overrides: Partial<Attempt>): Attempt {
  return {
    questionId: "Q1",
    solvedAt: 1000,
    mode: "study",
    selectedAnswer: 1,
    isCorrect: true,
    solveTimeMs: 1000,
    ...overrides,
  };
}

describe("getRecentlySolvedQuestionIds", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(getRecentlySolvedQuestionIds([], 10)).toEqual([]);
  });

  it("최근 푼 순서(내림차순)로 questionId를 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 3000 }),
      makeAttempt({ questionId: "Q3", solvedAt: 2000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 10)).toEqual(["Q2", "Q3", "Q1"]);
  });

  it("같은 문제를 여러 번 풀었으면 가장 최근 시각 기준으로 한 번만 나온다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000 }),
      makeAttempt({ questionId: "Q1", solvedAt: 5000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 10)).toEqual(["Q1", "Q2"]);
  });

  it("limit만큼만 반환한다", () => {
    const attempts = [
      makeAttempt({ questionId: "Q1", solvedAt: 1000 }),
      makeAttempt({ questionId: "Q2", solvedAt: 2000 }),
      makeAttempt({ questionId: "Q3", solvedAt: 3000 }),
    ];
    expect(getRecentlySolvedQuestionIds(attempts, 2)).toEqual(["Q3", "Q2"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/recentlySolved.test.ts
```

Expected: FAIL — `Cannot find module './recentlySolved'`

- [ ] **Step 3: 구현 — `src/lib/recentlySolved.ts`**

```ts
import type { Attempt } from "@/types/progress";

export function getRecentlySolvedQuestionIds(attempts: Attempt[], limit: number): string[] {
  const latestByQuestion = new Map<string, number>();
  for (const attempt of attempts) {
    const prev = latestByQuestion.get(attempt.questionId);
    if (prev === undefined || attempt.solvedAt > prev) {
      latestByQuestion.set(attempt.questionId, attempt.solvedAt);
    }
  }

  return [...latestByQuestion.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([questionId]) => questionId);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/recentlySolved.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/recentlySolved.ts src/lib/recentlySolved.test.ts
git commit -m "feat: 최근 푼 문제 추출 순수 함수"
```

---

### Task 3: 학습모드 화면에 즐겨찾기 추가

**Files:**
- Modify: `src/features/practice/QuestionCard.tsx`
- Modify: `src/features/practice/PracticeSession.tsx`

**Interfaces:**
- Consumes: `ProgressRepository.addFavorite` (기존, 이미 구현됨)
- Produces: `QuestionCardProps`에 `isFavorited: boolean`, `onFavorite: () => void` 추가

- [ ] **Step 1: `QuestionCard.tsx`에 즐겨찾기 버튼 추가**

`index / total` 표시 줄을 아래로 교체(같은 줄에 버튼 추가):

```tsx
interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  selectedAnswer: number | null;
  theoryLink: TheoryLink | null;
  isFavorited: boolean;
  onSelect: (answer: number) => void;
  onFavorite: () => void;
}

export function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  theoryLink,
  isFavorited,
  onSelect,
  onFavorite,
}: QuestionCardProps) {
  const isGraded = selectedAnswer !== null;
  const isCorrect = isGraded && isCorrectOption(question, selectedAnswer);

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={onFavorite}
          disabled={isFavorited}
          className="text-yellow-600 disabled:text-yellow-600"
        >
          {isFavorited ? "★ 즐겨찾기 완료" : "☆ 즐겨찾기"}
        </button>
      </div>
```

(이 아래 `<p className="text-lg font-medium...">{question.stem}</p>` 부터는 기존 그대로 — `div` 하나 안에 있던 `index/total` 줄만 위 블록으로 교체하고 나머지 JSX는 손대지 않는다.)

- [ ] **Step 2: `PracticeSession.tsx`에 즐겨찾기 상태·핸들러 추가**

`answers` state 옆에 `favorited` state를 추가하고, `select` 함수 아래에 `toggleFavorite` 함수를 추가한다.

```ts
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [favorited, setFavorited] = useState<Record<number, boolean>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
```

`select` 함수 바로 아래에 추가:

```ts
  function toggleFavorite() {
    if (favorited[current]) return;
    setFavorited((prev) => ({ ...prev, [current]: true }));
    progressRepository
      .addFavorite(question.questionId)
      .catch((err) => console.error("addFavorite failed:", err));
  }
```

`<QuestionCard>` 호출부에 prop 2개 추가:

```tsx
      <QuestionCard
        question={question}
        index={current}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        theoryLink={selectedAnswer !== null ? theoryLink : null}
        isFavorited={favorited[current] ?? false}
        onSelect={select}
        onFavorite={toggleFavorite}
      />
```

- [ ] **Step 3: 빌드·전체 테스트 확인**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: 전체 통과(이 태스크는 UI만 건드려 새 자동 테스트 없음 — 설계문서 8절 방침).

- [ ] **Step 4: 수동 QA**

```bash
npm run data
npm run dev
```

`/practice`에서 문제풀이 시작 → 문항 상단 "☆ 즐겨찾기" 클릭 → "★ 즐겨찾기 완료"로 바뀌고 재클릭 안 먹는지 확인 → 개발자도구 IndexedDB → `passflow` → `favorites`에 항목이 생겼는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/features/practice/QuestionCard.tsx src/features/practice/PracticeSession.tsx
git commit -m "feat: 학습모드 화면에 즐겨찾기 버튼 추가"
```

---

### Task 4: 복습 목록 표시 컴포넌트

**Files:**
- Create: `src/features/review/ReviewList.tsx`

**Interfaces:**
- Consumes: `Question` (`src/types/question.ts`)
- Produces: `ReviewListProps`, `ReviewList` 컴포넌트

이 태스크는 UI 컴포넌트라 설계문서 8절 방침대로 자동 테스트를 붙이지 않는다 — Task 6에서 실제 페이지에 연결한 뒤 한 번에 수동 QA한다.

- [ ] **Step 1: `src/features/review/ReviewList.tsx` 작성**

```tsx
"use client";

import type { Question } from "@/types/question";

interface ReviewListProps {
  questions: Question[];
  emptyMessage: string;
  onRemove?: (questionId: string) => void;
  onRetryAll: () => void;
}

export function ReviewList({ questions, emptyMessage, onRemove, onRetryAll }: ReviewListProps) {
  if (questions.length === 0) {
    return <p className="text-center text-gray-500 p-10">{emptyMessage}</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <button
        type="button"
        onClick={onRetryAll}
        className="self-start px-4 py-2 rounded bg-blue-600 text-white font-medium"
      >
        전체 다시 풀기 ({questions.length}문제)
      </button>
      <ul className="flex flex-col gap-2">
        {questions.map((question) => (
          <li
            key={question.questionId}
            className="flex items-center justify-between gap-3 p-3 rounded border"
          >
            <span className="text-sm truncate">{question.stem}</span>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(question.questionId)}
                className="text-sm text-gray-500 shrink-0"
              >
                제거
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음(아직 아무도 이 컴포넌트를 쓰지 않으니 unused-export 경고만 없으면 됨).

- [ ] **Step 3: Commit**

```bash
git add src/features/review/ReviewList.tsx
git commit -m "feat: 복습 목록 표시 컴포넌트"
```

---

### Task 5: 복습 페이지 (탭 3개 + 재도전 흐름)

**Files:**
- Create: `src/app/review/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `ReviewList`(Task 4), `getRecentlySolvedQuestionIds`(Task 2), `getTheoryMap`/`getWrongNotes`/`getFavorites`/`removeWrongNote`/`removeFavorite`(Task 1), `PracticeSession`/`SessionSummary`(기존 학습모드 계획 산출물)

- [ ] **Step 1: `src/app/review/page.tsx` 작성**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ReviewList } from "@/features/review/ReviewList";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { getRecentlySolvedQuestionIds } from "@/lib/recentlySolved";
import type { SessionSummary } from "@/lib/summary";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();
const progressRepository = new IndexedDbProgressRepository();

type Tab = "wrong" | "favorite" | "recent";

type Phase =
  | { kind: "list" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap }
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

async function hydrate(questionIds: string[]): Promise<Question[]> {
  const results = await Promise.allSettled(
    questionIds.map((id) => questionRepository.getQuestion(id))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Question> => r.status === "fulfilled")
    .map((r) => r.value);
}

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>("wrong");
  const [phase, setPhase] = useState<Phase>({ kind: "list" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadTab(nextTab: Tab) {
    setLoading(true);
    try {
      let questionIds: string[];
      if (nextTab === "wrong") {
        questionIds = (await progressRepository.getWrongNotes()).map((n) => n.questionId);
      } else if (nextTab === "favorite") {
        questionIds = (await progressRepository.getFavorites()).map((n) => n.questionId);
      } else {
        const attempts = await progressRepository.getAttempts();
        questionIds = getRecentlySolvedQuestionIds(attempts, 20);
      }
      setQuestions(await hydrate(questionIds));
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleRemove(questionId: string) {
    if (tab === "wrong") {
      await progressRepository.removeWrongNote(questionId).catch((err) => console.error(err));
    } else if (tab === "favorite") {
      await progressRepository.removeFavorite(questionId).catch((err) => console.error(err));
    }
    setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
  }

  async function handleRetryAll() {
    try {
      const theoryMap = await questionRepository.getTheoryMap();
      setPhase({ kind: "active", questions, theoryMap });
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
            void loadTab(tab);
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
      {loading ? (
        <p className="text-center p-10">불러오는 중...</p>
      ) : (
        <ReviewList
          questions={questions}
          emptyMessage={EMPTY_MESSAGE[tab]}
          onRemove={tab === "recent" ? undefined : handleRemove}
          onRetryAll={handleRetryAll}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 홈에 복습 진입 링크 추가**

`src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">PassFlow</h1>
      <div className="flex gap-4">
        <Link
          href="/practice"
          className="px-6 py-3 rounded bg-blue-600 text-white font-medium"
        >
          문제풀이 시작 (학습모드)
        </Link>
        <Link
          href="/review"
          className="px-6 py-3 rounded border font-medium"
        >
          복습
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 통과, `/review` 라우트가 목록에 나타남.

- [ ] **Step 4: 수동 QA (설계문서 8절 — UI는 자동 테스트 대상 아님)**

```bash
npm run data
npm run dev
```

1. `/practice`에서 문제 하나를 **오답**으로 풀고, 하나는 **즐겨찾기** 클릭 후 종료
2. `/` → "복습" 클릭 → 오답노트 탭에 방금 틀린 문제가 보이는지 확인
3. 즐겨찾기 탭으로 전환 → 방금 즐겨찾기한 문제가 보이는지 확인
4. 최근 푼 문제 탭 → 방금 푼 문제들이 최신순으로 보이는지, 제거 버튼이 **없는지** 확인
5. 오답노트 탭에서 항목 하나 "제거" → 목록에서 사라지는지, 개발자도구 IndexedDB `wrongNotes`에서도 지워졌는지 확인
6. 오답노트 탭에서 "전체 다시 풀기" → 학습모드 화면 그대로 뜨는지(키보드 1~4/Space/←→ 다 되는지) → 다 풀면 "복습 완료 — N문제 중 M문제 풀이 정답X 오답Y" 뜨는지 확인
7. "복습 목록으로" 클릭 → 방금 푼 내역이 최근 푼 문제 탭에 반영되는지 확인
8. 오답노트·즐겨찾기 둘 다 비어있는 상태에서 각 탭에 안내 문구("오답노트가 비어있다." 등)가 뜨는지 확인

전부 통과하면 다음 단계로. 하나라도 깨지면 해당 스텝으로 돌아가 원인을 고친다.

- [ ] **Step 5: Commit**

```bash
git add src/app/review/page.tsx src/app/page.tsx
git commit -m "feat: 복습 화면 (오답노트/즐겨찾기/최근 푼 문제 + 전체 다시 풀기)"
```

---

## Self-Review 결과

**Spec coverage**: 설계문서 2절 복습 4개 항목(오답노트→Task 5, 즐겨찾기→Task 3+5, 틀린 문제 다시 풀기→Task 5 `handleRetryAll`, 최근 푼 문제 다시 풀기→Task 2+5) 전부 대응. Scope 결정에서 명시적으로 뺀 것(자동 졸업, 개별 재도전, 언페이버릿, 최근탭 제거)은 설계문서에 없는 항목이라 제외가 맞음.

**Placeholder scan**: 전체 재확인 — "TODO"/"나중에" 패턴 없음. 모든 코드 블록이 실제 최종 코드.

**Type consistency**: `WrongNote`/`Favorite`(Task 1) → Task 5에서 `.questionId` 필드로 동일하게 소비. `getRecentlySolvedQuestionIds`(Task 2) 시그니처 `(attempts, limit) => string[]` → Task 5에서 `getAttempts()`·`20` 그대로 호출. `ReviewListProps`(Task 4) → Task 5에서 동일 필드(`questions`/`emptyMessage`/`onRemove`/`onRetryAll`)로 소비. `QuestionCard`의 `isFavorited`/`onFavorite`(Task 3) 신규 prop이 기존 `PracticeSession` 호출부와 시그니처 일치.
