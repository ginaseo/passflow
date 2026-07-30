# 문제풀이 학습모드 MVP 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데이터 레이어(타입, Repository, 순수 로직)를 완성하고, 그 위에 학습모드 랜덤 문제풀이 화면 하나를 끝까지 동작하게 만든다 — `npm run dev` → 과목 선택 → 문제 풀이 → 채점 → 관련이론 링크 → IndexedDB에 기록까지.

**Architecture:** `docs/specs/2026-07-28-passflow-mvp-design.md` 4절 그대로 따른다. UI(`src/features`) → 순수 로직(`src/lib`) → Repository(`src/repositories`) → 데이터(정적 JSON + IndexedDB) 3층 구조. 순수 함수는 전부 Vitest로 테스트하고, UI는 Phase 1 방침(설계문서 8절)대로 자동 테스트하지 않는다 — 대신 각 UI 단계 끝에 수동 QA 스크립트를 둔다.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Vitest / `idb`(IndexedDB 프라미스 래퍼) / `fake-indexeddb`(테스트용 IndexedDB 폴리필)

## Scope 결정 (사전 조사 결과)

설계문서 2절 IA는 메뉴 5개(Dashboard/문제풀이/복습/리포트/설정)를 정의하지만, 전부를 한 계획에 넣으면 리뷰 단위가 너무 커진다. 이 계획은 **문제풀이 화면 중 학습모드 하나**만 끝까지 만든다. 나머지(시험모드, 회차별 진입, 복습, 리포트, Dashboard, 설정)는 이 계획이 만드는 Repository/lib 위에 그대로 얹이는 후속 계획이다 — 이번에 고정하는 인터페이스(`QuestionRepository`, `ProgressRepository`)를 다시 건드릴 필요는 없다.

**의도적으로 이번에 안 하는 것** (다음 계획 몫):
- 시험모드(정답 숨김, 일괄채점, 타이머 UI), 모드 전환 토글
- 회차별 진입, 문항수 20/40/100 중 상한 넘는 과목 처리 UX
- `SettingsRepository`/설정 화면 — `defaultMode` 등 설정값 저장이 없으니 이번 화면은 학습모드 고정
- 복습(오답노트/즐겨찾기 화면), 리포트, Dashboard 화면 — Repository 메서드는 이번에 구현하지만 화면은 없음
- **PDF 뷰어 연동** — 설계문서 3.3절의 "클릭 시 해당 페이지로 PDF 열기"는 이번 화면에서 텍스트 표시(`관련 이론: {label} (p.{page})`)로만 구현한다. PDF 자산이 저장소에 없어 지금 구현 불가 — 최종 리뷰(2026-07-30)에서 이월 누락으로 지적되어 여기 명시한다.
- **IndexedDB→localStorage 폴백** — 설계문서 170행이 Phase 1 요구사항으로 명시하지만 이번 계획은 구현하지 않는다. 이번 화면은 `recordAttempt` 실패를 콘솔에 로그만 남기고(사용자 배너 없음) 조용히 넘어간다. 최종 리뷰에서 이월 누락으로 지적되어 여기 명시한다.

**사전 조사에서 찾은 데이터 이슈 4건** (계획에 반영, 뒤 Task에서 처리):
1. `theory_map.json` 376개 중 **56개**가 PDF 추출 시 앞부분이 잘린 이름(`"(Waterfall Model)"`, `"점진적 모형)"` 형태) — Task 4에서 방어
2. 문제 데이터 2,900건 중 **10건**이 `subjectName` 필드가 `undefined` — 코드에서 이 필드를 직접 쓰지 않고 과목번호(1~5) 기반 상수 테이블을 쓰는 것으로 회피
3. `scripts/copy-data.mjs`가 **이미지(`data/images/*.png`, 110개·5.6MB)를 안 복사한다** — 문제 92개가 이미지 참조 중이라 그대로 두면 화면에서 깨짐. Task 1에서 수정
4. **(최종 리뷰에서 발견, 계획 단계 누락)** 문제 2,900건 중 **4건**(`2017-1-Q2`, `2017-1-Q3`, `2018-3-Q39`, `2021-2-Q75`)이 `answer` 필드에 단일 숫자가 아니라 배열(복수정답)을 담고 있다 — `Question.answer: number | number[]`로 넓히고 채점·정답표시 로직 모두 배열을 처리하도록 최종 리뷰 후 fix wave에서 수정

**CodeRabbit 리뷰(PR #1) 이월 항목** — 지적은 맞지만 전부 실사용 버그 아님(잠복결함 또는 코드품질 개선), 다음에 해당 파일 건드릴 때 같이 처리:
- `scripts/copy-data.mjs`의 이미지 카운트(`readdirSync(imagesSrc).length`)가 최상위 항목만 셈 — 지금 데이터는 평면구조라 정확하지만, 나중에 `images/`를 하위폴더로 나누면 콘솔 로그 숫자만 부정확해짐(복사 자체는 `cpSync recursive`라 안전)
- `src/repositories/ProgressRepository.test.ts`의 "오늘/전체" 테스트가 실제 `Date.now()`에 의존 — DST/자정걸침 이론상 플레이키 가능. 이 프로젝트는 한국(DST 없음)·CI는 보통 UTC(DST 없음)라 실질 리스크 거의 0, 급하지 않음
- `QuestionRepository.ts`(`loadExam`/`loadIndex`)와 `app/practice/page.tsx`의 fetch가 `res.ok` 체크 없이 바로 `.json()` 호출 — 404/5xx 시 에러 메시지가 불명확(`SyntaxError`)해지지만, 이미 `.catch`/try-catch로 감싸져 있어 사용자에게는 동일한 error phase로 정상 라우팅됨. 개발자 디버깅 편의 개선이지 사용자 영향 없음

**⚠️ 문서-코드 드리프트 안내**: 아래 각 Task의 코드 샘플은 **작성 당시(구현 착수 전)** 스펙이다. 구현 과정의 최종 브랜치 리뷰·fix wave·Codex 리뷰에서 여러 문제가 발견돼 실제 코드는 이미 고쳐졌지만, Task 원문은 그 과정을 기록하는 역사적 스냅샷이라 소급 수정하지 않았다(수정 이력은 git log가 진실원본). CodeRabbit이 PR #1 리뷰에서 이 불일치를 "Major" 8건으로 지적했으나, **전부 문서만 뒤처진 것이고 실제 코드엔 이미 반영돼 있다** — 확인 결과:

| Task 원문이 놓친 것 | 실제로 고친 커밋 |
|---|---|
| `answer: number` (복수정답 미처리) | `f74692b` — `Question.answer: number \| number[]`, `isCorrectOption` 추가 |
| `parseQuestionId`에 `-Q` 없을 때 검증 없음 | `3d08c13` |
| `getDashboardSummary`가 롤링 24h (캘린더 날짜 아님) | `917d19f` |
| `loadExam`/`loadIndex` fetch 실패 시 캐시 오염 | `f74692b` |
| `recordAttempt` 실패 무시 | `f74692b` |
| `addWrongNote` 미배선(오답 자동등록 안 됨) | `f74692b` |
| 키보드 핸들러에 모디파이어키 가드 없음 | `f74692b` |
| 빈 문제풀/로딩실패 시 에러 처리 없음 | `a59ede4` |

## Global Constraints

- 설계문서 4절 원칙 8번: 모든 비즈니스 로직은 순수 함수로, UI·Repository에 직접 의존하지 않는다.
- 설계문서 8절: `/lib`의 순수 함수만 Vitest로 테스트한다. UI 컴포넌트 자동 테스트는 Phase 1 범위 밖.
- 설계문서 3.3절(2026-07-30 개정): 관련이론은 `sinagong` 있으면 `theory_map.json` 1순위, 없으면 과목 시작페이지 2순위. **주의**: 같은 문서 5절 177행은 개정 전 문구("과목 시작 페이지로 이동")가 남아 있다 — 3.3절이 최신이므로 그쪽을 따른다.
- `data/exam_*.json`, `data/theory_map.json` 스키마는 읽기 전용, 필드 추가 없음(설계문서 3.1절).
- `questionId` 형식은 `${examId}-Q${qnum}` 고정(예: `2020-1-2-Q45` — examId 자체에 하이픈이 있을 수 있음에 주의).

---

## 파일 구조

```text
src/types/question.ts        Question, Exam, ExamSummary
src/types/theory.ts          TheoryEntry, TheoryLink
src/types/progress.ts        Attempt, QuestionStats, DashboardSummary, Mode

src/lib/questionId.ts        makeQuestionId / parseQuestionId
src/lib/grading.ts           gradeAnswer
src/lib/sampling.ts          pickRandomQuestions
src/lib/theory.ts            SUBJECT_NAMES, SUBJECT_START_PAGES, isTheoryNameTruncated, resolveTheoryLink
src/lib/timer.ts             elapsedMs, isTimedOut

src/repositories/db.ts                    IndexedDB 스키마 + openDB
src/repositories/ProgressRepository.ts    interface + IndexedDbProgressRepository
src/repositories/QuestionRepository.ts    interface + JsonQuestionRepository

src/features/practice/PracticeSetup.tsx    과목/문항수 선택
src/features/practice/QuestionCard.tsx     문제 표시 + 채점 결과 + 관련이론
src/features/practice/PracticeSession.tsx  세션 상태·키보드 핸들링

src/app/practice/page.tsx     라우트 (PracticeSetup → PracticeSession 전환)
src/app/page.tsx              기존 홈에 "문제풀이 시작" 링크 추가 (수정)

scripts/copy-data.mjs         수정: data/images/ 도 함께 복사
vitest.config.ts              신규
```

---

### Task 1: 개발 도구 설치 + 데이터 복사 스크립트 이미지 누락 수정

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `scripts/copy-data.mjs`

**Interfaces:**
- Produces: `npm run test` 커맨드, `npm run data`가 `public/data/images/`까지 복사

- [ ] **Step 1: 패키지 설치**

```bash
npm install idb
npm install -D vitest fake-indexeddb @vitejs/plugin-react jsdom
```

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
  },
});
```

`src/repositories`처럼 IndexedDB가 필요한 테스트는 파일 상단에서 `fake-indexeddb/auto`를 import해 그 파일에서만 폴리필을 켠다(전역 setup 파일을 두지 않는 이유: 순수 함수 테스트까지 매번 IndexedDB 폴리필을 로드할 이유가 없다).

- [ ] **Step 3: `package.json`에 스크립트 추가**

`"lint": "eslint"` 다음 줄에 추가:

```json
    "test": "vitest run",
```

- [ ] **Step 4: `scripts/copy-data.mjs`에서 이미지 디렉터리도 복사**

`src/CompWork/passflow-data/data/images/*.png`가 문제 JSON의 `image` 필드(`"images/2016-1_q5.png"` 형식, 92문항)가 가리키는 대상인데 지금 스크립트는 `.json`만 복사한다. `cpSync`로 `images/` 서브디렉터리째 복사하도록 고친다.

`scripts/copy-data.mjs` 전체를 아래로 교체:

```js
// 문제 데이터를 가져온다. 원본 JSON과 이미지를 public/data/로 복사한다.
// 원본 위치는 .env.local의 PASSFLOW_DATA_DIR로 지정한다.
import { readdirSync, mkdirSync, copyFileSync, cpSync, rmSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = process.env.PASSFLOW_DATA_DIR;
if (!SRC) {
  console.error("PASSFLOW_DATA_DIR이 없다. .env.local에 원본 디렉토리 경로를 지정한다.");
  process.exit(1);
}

const DEST = resolve("public/data");

let names;
try {
  names = readdirSync(SRC);
} catch {
  console.error(`원본 디렉토리를 열 수 없다: ${SRC}`);
  process.exit(1);
}

// `_`로 시작하는 파일은 작업용 산출물이라 앱에 넣지 않는다.
const targets = names.filter((n) => n.endsWith(".json") && !n.startsWith("_"));
if (targets.length === 0) {
  console.error(`복사할 JSON이 없다: ${SRC}`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const name of targets) {
  copyFileSync(join(SRC, name), join(DEST, name));
}

const imagesSrc = join(SRC, "images");
let imageCount = 0;
if (existsSync(imagesSrc)) {
  cpSync(imagesSrc, join(DEST, "images"), { recursive: true });
  imageCount = readdirSync(imagesSrc).length;
}

console.log(`${targets.length}개 JSON, 이미지 ${imageCount}개를 ${DEST}로 복사했다.`);
```

- [ ] **Step 5: 동작 확인**

```bash
npm run data
```

Expected: `38개 JSON, 110개를 ...로 복사했다` (이미지 개수는 원본 상태에 따라 달라질 수 있음, 0이 아니면 됨). `public/data/images/2016-1_q5.png`가 실제로 생겼는지 확인:

```bash
ls public/data/images | head -3
```

- [ ] **Step 6: `npm run test` 확인 (아직 테스트 파일 없음, 에러 없이 통과해야 함)**

```bash
npm run test
```

Expected: `No test files found` 경고와 함께 종료 코드 0 (vitest는 테스트 파일이 없으면 기본적으로 실패 처리한다 — 이 경우 종료 코드가 1이어도 정상이다. Task 2부터 실제 테스트가 생기므로 지금은 통과 여부를 눈으로만 확인한다).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts scripts/copy-data.mjs
git commit -m "chore: Vitest/idb 도입, 데이터 복사 스크립트에 이미지 포함"
```

---

### Task 2: 문제 타입 + questionId 헬퍼 + 채점 로직

**Files:**
- Create: `src/types/question.ts`
- Create: `src/lib/questionId.ts`
- Create: `src/lib/questionId.test.ts`
- Create: `src/lib/grading.ts`
- Create: `src/lib/grading.test.ts`

**Interfaces:**
- Produces:
  - `type Question = { questionId: string; examId: string; qnum: number; stem: string; options: string[]; subject: number; answer: number; explanation: string; image: string | null; sinagong?: string }`
  - `type Exam = { examId: string; title: string; questions: Question[] }`
  - `type ExamSummary = { examId: string; title: string; count: number }`
  - `makeQuestionId(examId: string, qnum: number): string`
  - `parseQuestionId(questionId: string): { examId: string; qnum: number }`
  - `gradeAnswer(question: Question, selectedAnswer: number): boolean`

- [ ] **Step 1: `src/types/question.ts` 작성**

```ts
export interface Question {
  questionId: string;
  examId: string;
  qnum: number;
  stem: string;
  options: string[];
  subject: number;
  answer: number;
  explanation: string;
  image: string | null;
  sinagong?: string;
}

export interface Exam {
  examId: string;
  title: string;
  questions: Question[];
}

export interface ExamSummary {
  examId: string;
  title: string;
  count: number;
}
```

`data/exam_*.json`의 원본 문항에는 `questionId`·`examId`가 없다(파일 단위로만 `examId`가 있고, 문항은 `qnum`만 가짐). `JsonQuestionRepository`(Task 7)가 로드 시점에 합성해 이 `Question` 타입으로 만든다 — 원본 JSON 스키마를 그대로 타입으로 옮기지 않는 이유가 이것이다.

- [ ] **Step 2: 실패하는 테스트 작성 — `src/lib/questionId.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { makeQuestionId, parseQuestionId } from "./questionId";

describe("makeQuestionId", () => {
  it("examId와 qnum을 결합한다", () => {
    expect(makeQuestionId("2023-1", 13)).toBe("2023-1-Q13");
  });
});

describe("parseQuestionId", () => {
  it("일반 examId를 분리한다", () => {
    expect(parseQuestionId("2023-1-Q13")).toEqual({ examId: "2023-1", qnum: 13 });
  });

  it("하이픈이 포함된 examId도 분리한다 (2020년 1·2회 통합)", () => {
    expect(parseQuestionId("2020-1-2-Q45")).toEqual({ examId: "2020-1-2", qnum: 45 });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npx vitest run src/lib/questionId.test.ts
```

Expected: FAIL — `Cannot find module './questionId'`

- [ ] **Step 4: 구현 — `src/lib/questionId.ts`**

```ts
export function makeQuestionId(examId: string, qnum: number): string {
  return `${examId}-Q${qnum}`;
}

export function parseQuestionId(questionId: string): { examId: string; qnum: number } {
  const markerIndex = questionId.lastIndexOf("-Q");
  return {
    examId: questionId.slice(0, markerIndex),
    qnum: Number(questionId.slice(markerIndex + 2)),
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/lib/questionId.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: 실패하는 테스트 작성 — `src/lib/grading.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gradeAnswer } from "./grading";
import type { Question } from "@/types/question";

const baseQuestion: Question = {
  questionId: "2023-1-Q1",
  examId: "2023-1",
  qnum: 1,
  stem: "테스트 문항",
  options: ["1번", "2번", "3번", "4번"],
  subject: 1,
  answer: 3,
  explanation: "설명",
  image: null,
};

describe("gradeAnswer", () => {
  it("선택한 답이 정답과 같으면 true", () => {
    expect(gradeAnswer(baseQuestion, 3)).toBe(true);
  });

  it("선택한 답이 정답과 다르면 false", () => {
    expect(gradeAnswer(baseQuestion, 1)).toBe(false);
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

```bash
npx vitest run src/lib/grading.test.ts
```

Expected: FAIL — `Cannot find module './grading'`

- [ ] **Step 8: 구현 — `src/lib/grading.ts`**

```ts
import type { Question } from "@/types/question";

export function gradeAnswer(question: Question, selectedAnswer: number): boolean {
  return selectedAnswer === question.answer;
}
```

- [ ] **Step 9: 테스트 통과 확인**

```bash
npx vitest run src/lib/grading.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 10: Commit**

```bash
git add src/types/question.ts src/lib/questionId.ts src/lib/questionId.test.ts src/lib/grading.ts src/lib/grading.test.ts
git commit -m "feat: 문제 타입, questionId 파싱, 채점 로직"
```

---

### Task 3: 랜덤 문항 추출

**Files:**
- Create: `src/lib/sampling.ts`
- Create: `src/lib/sampling.test.ts`

**Interfaces:**
- Consumes: `Question` (`src/types/question.ts`, Task 2)
- Produces: `pickRandomQuestions(questions: Question[], count: number, rng?: () => number): Question[]`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { pickRandomQuestions } from "./sampling";
import type { Question } from "@/types/question";

function makeQuestions(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    questionId: `test-Q${i}`,
    examId: "test",
    qnum: i,
    stem: `문항 ${i}`,
    options: ["a", "b", "c", "d"],
    subject: 1,
    answer: 1,
    explanation: "",
    image: null,
  }));
}

describe("pickRandomQuestions", () => {
  it("count만큼 중복 없이 뽑는다", () => {
    const pool = makeQuestions(10);
    const picked = pickRandomQuestions(pool, 4, () => 0.5);
    expect(picked).toHaveLength(4);
    const ids = new Set(picked.map((q) => q.questionId));
    expect(ids.size).toBe(4);
  });

  it("count가 풀 크기보다 크면 풀 전체를 반환한다", () => {
    const pool = makeQuestions(3);
    const picked = pickRandomQuestions(pool, 10, () => 0.5);
    expect(picked).toHaveLength(3);
  });

  it("같은 rng 시퀀스면 같은 결과를 낸다 (결정론적 셔플 검증)", () => {
    const pool = makeQuestions(5);
    const sequence = [0.9, 0.1, 0.5, 0.3];
    let call = 0;
    const rng = () => sequence[call++ % sequence.length];

    call = 0;
    const first = pickRandomQuestions(pool, 5, rng);
    call = 0;
    const second = pickRandomQuestions(pool, 5, rng);

    expect(first.map((q) => q.questionId)).toEqual(second.map((q) => q.questionId));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/sampling.test.ts
```

Expected: FAIL — `Cannot find module './sampling'`

- [ ] **Step 3: 구현 — `src/lib/sampling.ts`**

Fisher-Yates 셔플 후 앞에서 `count`개를 자른다. `rng`를 주입 가능하게 둔 이유는 테스트 결정성 때문이다(기본값은 `Math.random`).

```ts
import type { Question } from "@/types/question";

export function pickRandomQuestions(
  questions: Question[],
  count: number,
  rng: () => number = Math.random
): Question[] {
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/sampling.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/sampling.ts src/lib/sampling.test.ts
git commit -m "feat: 랜덤 문항 추출(Fisher-Yates, 결정론적 테스트 가능)"
```

---

### Task 4: 관련이론 매핑 (2단 조회 + 이름 손상 방어)

설계문서 3.3절 그대로 구현한다. `theory_map.json` 376개 중 56개는 PDF 추출 과정에서 이름 앞부분이 잘렸다(`"(Waterfall Model)"`, `"점진적 모형)"` 형태) — 그대로 화면에 뿌리면 사용자에게 깨진 데이터로 보인다. 이 손상은 `page` 필드에는 없다(376개 전부 정상) — 그래서 손상된 이름을 만나면 이름만 감추고 과목명으로 대체하되, **정밀 페이지는 그대로 쓴다**(2순위 fallback처럼 과목 시작 페이지로 낮추지 않는다 — 이미 알고 있는 정확한 페이지를 버릴 이유가 없다).

문항의 `subjectName` 필드는 2,900건 중 10건이 `undefined`라 화면 표시에 직접 쓰면 깨진다. 과목 이름은 문항 필드 대신 과목번호(1~5) 기반 상수 테이블에서 가져온다.

**Files:**
- Create: `src/types/theory.ts`
- Create: `src/lib/theory.ts`
- Create: `src/lib/theory.test.ts`

**Interfaces:**
- Consumes: `Question` (`src/types/question.ts`, Task 2)
- Produces:
  - `type TheoryEntry = { tag: string | null; name: string; page: number; subject: string }`
  - `type TheoryMap = Record<string, TheoryEntry>`
  - `type TheoryLink = { label: string; page: number }`
  - `SUBJECT_NAMES: Record<number, string>`
  - `SUBJECT_START_PAGES: Record<number, number>`
  - `isTheoryNameTruncated(name: string): boolean`
  - `resolveTheoryLink(question: Question, theoryMap: TheoryMap): TheoryLink`

- [ ] **Step 1: `src/types/theory.ts` 작성**

```ts
export interface TheoryEntry {
  tag: string | null;
  name: string;
  page: number;
  subject: string;
}

export type TheoryMap = Record<string, TheoryEntry>;

export interface TheoryLink {
  label: string;
  page: number;
}
```

- [ ] **Step 2: 실패하는 테스트 작성 — `src/lib/theory.test.ts`**

과목 시작 페이지 값(4/25/47/69/99)은 `passflow-data/data/theory_map.json`에서 과목별 `page` 최솟값을 실측한 값이다(플레이스홀더 아님).

```ts
import { describe, expect, it } from "vitest";
import { isTheoryNameTruncated, resolveTheoryLink, SUBJECT_START_PAGES } from "./theory";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

describe("isTheoryNameTruncated", () => {
  it("'('로 시작하면 잘린 것으로 본다", () => {
    expect(isTheoryNameTruncated("(Waterfall Model)")).toBe(true);
  });

  it("여는 괄호 없이 ')'로 끝나면 잘린 것으로 본다", () => {
    expect(isTheoryNameTruncated("점진적 모형)")).toBe(true);
  });

  it("괄호가 정상적으로 짝지어지면 잘린 것이 아니다", () => {
    expect(isTheoryNameTruncated("핵심 소프트웨어 공학")).toBe(false);
    expect(isTheoryNameTruncated("스택(Stack)")).toBe(false);
  });
});

function makeQuestion(overrides: Partial<Question>): Question {
  return {
    questionId: "test-Q1",
    examId: "test",
    qnum: 1,
    stem: "문항",
    options: ["a", "b", "c", "d"],
    subject: 2,
    answer: 1,
    explanation: "",
    image: null,
    ...overrides,
  };
}

const theoryMap: TheoryMap = {
  "075": { tag: "25.8", name: "스택(Stack)", page: 25, subject: "2과목 소프트웨어 개발" },
  "003": { tag: "24.7", name: "(Waterfall Model)", page: 4, subject: "1과목 소프트웨어 설계" },
};

describe("resolveTheoryLink", () => {
  it("sinagong이 있고 이름이 정상이면 이론명 + 정밀 페이지", () => {
    const q = makeQuestion({ subject: 2, sinagong: "075" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({ label: "스택(Stack)", page: 25 });
  });

  it("sinagong은 있지만 이름이 손상되면 과목명 + 정밀 페이지(과목 시작페이지 아님)", () => {
    const q = makeQuestion({ subject: 1, sinagong: "003" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({ label: "1과목 소프트웨어 설계", page: 4 });
  });

  it("sinagong이 theory_map에 없으면 과목 시작페이지로 폴백", () => {
    const q = makeQuestion({ subject: 3, sinagong: "999" });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({
      label: "3과목 데이터베이스 구축",
      page: SUBJECT_START_PAGES[3],
    });
  });

  it("sinagong이 없으면 과목 시작페이지로 폴백", () => {
    const q = makeQuestion({ subject: 5 });
    expect(resolveTheoryLink(q, theoryMap)).toEqual({
      label: "5과목 정보시스템 구축 관리",
      page: SUBJECT_START_PAGES[5],
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npx vitest run src/lib/theory.test.ts
```

Expected: FAIL — `Cannot find module './theory'`

- [ ] **Step 4: 구현 — `src/lib/theory.ts`**

```ts
import type { Question } from "@/types/question";
import type { TheoryLink, TheoryMap } from "@/types/theory";

// data/theory_map.json 376개 항목을 subject별로 실측한 최소 page 값 (2026-07-30 기준).
export const SUBJECT_NAMES: Record<number, string> = {
  1: "1과목 소프트웨어 설계",
  2: "2과목 소프트웨어 개발",
  3: "3과목 데이터베이스 구축",
  4: "4과목 프로그래밍 언어 활용",
  5: "5과목 정보시스템 구축 관리",
};

export const SUBJECT_START_PAGES: Record<number, number> = {
  1: 4,
  2: 25,
  3: 47,
  4: 69,
  5: 99,
};

// theory_map.json은 PDF 목차에서 추출한 산출물이라, 항목 앞부분이 잘린 경우가 있다
// (예: "소프트웨어 생명주기(Software Life Cycle)" -> "(Software Life Cycle)").
// page 필드는 손상되지 않으므로, 이름만 감추고 페이지는 그대로 쓴다.
export function isTheoryNameTruncated(name: string): boolean {
  if (name.startsWith("(")) return true;
  const openCount = (name.match(/\(/g) ?? []).length;
  const closeCount = (name.match(/\)/g) ?? []).length;
  return name.endsWith(")") && openCount !== closeCount;
}

export function resolveTheoryLink(question: Question, theoryMap: TheoryMap): TheoryLink {
  const subjectName = SUBJECT_NAMES[question.subject];

  if (question.sinagong) {
    const entry = theoryMap[question.sinagong];
    if (entry) {
      const label = isTheoryNameTruncated(entry.name) ? subjectName : entry.name;
      return { label, page: entry.page };
    }
  }

  return { label: subjectName, page: SUBJECT_START_PAGES[question.subject] };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/lib/theory.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/theory.ts src/lib/theory.ts src/lib/theory.test.ts
git commit -m "feat: 관련이론 2단 조회 + 손상된 이름 방어"
```

---

### Task 5: 타이머 (경과시간 · 시간초과 판정)

**Files:**
- Create: `src/lib/timer.ts`
- Create: `src/lib/timer.test.ts`

**Interfaces:**
- Produces: `elapsedMs(startedAt: number, now: number): number`, `isTimedOut(startedAt: number, now: number, limitSeconds: number | null): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { elapsedMs, isTimedOut } from "./timer";

describe("elapsedMs", () => {
  it("now - startedAt을 반환한다", () => {
    expect(elapsedMs(1000, 2500)).toBe(1500);
  });
});

describe("isTimedOut", () => {
  it("limitSeconds가 null이면 제한 없음 -> 항상 false", () => {
    expect(isTimedOut(0, 999_999_999, null)).toBe(false);
  });

  it("경과시간이 제한을 넘으면 true", () => {
    expect(isTimedOut(0, 61_000, 60)).toBe(true);
  });

  it("경과시간이 제한 이내면 false", () => {
    expect(isTimedOut(0, 59_000, 60)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/timer.test.ts
```

Expected: FAIL — `Cannot find module './timer'`

- [ ] **Step 3: 구현 — `src/lib/timer.ts`**

```ts
export function elapsedMs(startedAt: number, now: number): number {
  return now - startedAt;
}

export function isTimedOut(startedAt: number, now: number, limitSeconds: number | null): boolean {
  if (limitSeconds === null) return false;
  return elapsedMs(startedAt, now) >= limitSeconds * 1000;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/timer.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/timer.ts src/lib/timer.test.ts
git commit -m "feat: 경과시간/시간초과 판정 순수 함수"
```

(이번 계획의 화면은 전체 제한시간 UI를 아직 안 붙인다 — 시험모드 계획에서 소비한다. 지금은 함수만 준비해둔다.)

---

### Task 6: IndexedDB 스키마 + ProgressRepository

**Files:**
- Create: `src/types/progress.ts`
- Create: `src/repositories/db.ts`
- Create: `src/repositories/ProgressRepository.ts`
- Create: `src/repositories/ProgressRepository.test.ts`

**Interfaces:**
- Consumes: `Question`/`questionId` 형식 (Task 2)
- Produces:
  - `type Attempt = { id?: number; questionId: string; solvedAt: number; mode: "exam" | "study"; selectedAnswer: number; isCorrect: boolean; solveTimeMs: number }`
  - `type QuestionStats = { questionId: string; correctCount: number; wrongCount: number; lastSolvedAt: number }`
  - `type DashboardSummary = { todayCount: number; todayAccuracy: number; totalCount: number; totalAccuracy: number }`
  - `interface ProgressRepository { recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>; getAttempts(questionId?: string): Promise<Attempt[]>; getQuestionStats(questionId: string): Promise<QuestionStats>; getDashboardSummary(): Promise<DashboardSummary>; addWrongNote(questionId: string): Promise<void>; addFavorite(questionId: string): Promise<void>; }`
  - `IndexedDbProgressRepository implements ProgressRepository`

- [ ] **Step 1: `src/types/progress.ts` 작성**

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
```

- [ ] **Step 2: `src/repositories/db.ts` 작성 (IndexedDB 스키마)**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Attempt, QuestionStats } from "@/types/progress";

interface PassFlowDB extends DBSchema {
  attempts: {
    key: number;
    value: Attempt;
    indexes: { questionId: string };
  };
  questionStats: {
    key: string;
    value: QuestionStats;
  };
  wrongNotes: {
    key: string;
    value: { questionId: string; addedAt: number };
  };
  favorites: {
    key: string;
    value: { questionId: string; addedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<PassFlowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<PassFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PassFlowDB>("passflow", 1, {
      upgrade(db) {
        const attempts = db.createObjectStore("attempts", {
          keyPath: "id",
          autoIncrement: true,
        });
        attempts.createIndex("questionId", "questionId");
        db.createObjectStore("questionStats", { keyPath: "questionId" });
        db.createObjectStore("wrongNotes", { keyPath: "questionId" });
        db.createObjectStore("favorites", { keyPath: "questionId" });
      },
    });
  }
  return dbPromise;
}
```

- [ ] **Step 3: 실패하는 테스트 작성 — `src/repositories/ProgressRepository.test.ts`**

`fake-indexeddb/auto`를 파일 맨 위에서 import한다 — 이 한 줄이 Node 테스트 환경에 `indexedDB` 전역을 주입한다(jsdom도 기본으로는 IndexedDB를 구현하지 않는다).

```ts
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbProgressRepository } from "./ProgressRepository";
import { getDb } from "./db";

beforeEach(async () => {
  // 테스트마다 DB를 비운다: fake-indexeddb는 프로세스 전역이라 이전 테스트의 데이터가 남는다.
  const db = await getDb();
  await db.clear("attempts");
  await db.clear("questionStats");
  await db.clear("wrongNotes");
  await db.clear("favorites");
});

describe("IndexedDbProgressRepository", () => {
  it("recordAttempt는 Attempt를 저장하고 QuestionStats를 갱신한다", async () => {
    const repo = new IndexedDbProgressRepository();

    await repo.recordAttempt({
      questionId: "2023-1-Q1",
      solvedAt: 1000,
      mode: "study",
      selectedAnswer: 2,
      isCorrect: true,
      solveTimeMs: 5000,
    });

    const attempts = await repo.getAttempts("2023-1-Q1");
    expect(attempts).toHaveLength(1);
    expect(attempts[0].isCorrect).toBe(true);

    const stats = await repo.getQuestionStats("2023-1-Q1");
    expect(stats).toEqual({
      questionId: "2023-1-Q1",
      correctCount: 1,
      wrongCount: 0,
      lastSolvedAt: 1000,
    });
  });

  it("같은 문제를 여러 번 풀면 QuestionStats가 누적된다", async () => {
    const repo = new IndexedDbProgressRepository();
    const base = {
      questionId: "2023-1-Q1",
      mode: "study" as const,
      selectedAnswer: 1,
      solveTimeMs: 1000,
    };

    await repo.recordAttempt({ ...base, solvedAt: 1000, isCorrect: true });
    await repo.recordAttempt({ ...base, solvedAt: 2000, isCorrect: false });
    await repo.recordAttempt({ ...base, solvedAt: 3000, isCorrect: true });

    const stats = await repo.getQuestionStats("2023-1-Q1");
    expect(stats.correctCount).toBe(2);
    expect(stats.wrongCount).toBe(1);
    expect(stats.lastSolvedAt).toBe(3000);
  });

  it("한 번도 안 푼 문제의 QuestionStats는 0으로 채워 반환한다", async () => {
    const repo = new IndexedDbProgressRepository();
    const stats = await repo.getQuestionStats("never-solved-Q1");
    expect(stats).toEqual({
      questionId: "never-solved-Q1",
      correctCount: 0,
      wrongCount: 0,
      lastSolvedAt: 0,
    });
  });

  it("addWrongNote / addFavorite는 questionId를 저장한다", async () => {
    const repo = new IndexedDbProgressRepository();
    await repo.addWrongNote("2023-1-Q1");
    await repo.addFavorite("2023-1-Q1");

    const db = await getDb();
    expect(await db.get("wrongNotes", "2023-1-Q1")).toBeDefined();
    expect(await db.get("favorites", "2023-1-Q1")).toBeDefined();
  });

  it("getDashboardSummary는 오늘/전체 정답률을 계산한다", async () => {
    const repo = new IndexedDbProgressRepository();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const yesterday = now - oneDayMs - 1000;

    await repo.recordAttempt({
      questionId: "Q1",
      solvedAt: now,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
    });
    await repo.recordAttempt({
      questionId: "Q2",
      solvedAt: now,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: false,
      solveTimeMs: 1000,
    });
    await repo.recordAttempt({
      questionId: "Q3",
      solvedAt: yesterday,
      mode: "study",
      selectedAnswer: 1,
      isCorrect: true,
      solveTimeMs: 1000,
    });

    const summary = await repo.getDashboardSummary();
    expect(summary.todayCount).toBe(2);
    expect(summary.todayAccuracy).toBe(0.5);
    expect(summary.totalCount).toBe(3);
    expect(summary.totalAccuracy).toBeCloseTo(2 / 3);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

```bash
npx vitest run src/repositories/ProgressRepository.test.ts
```

Expected: FAIL — `Cannot find module './ProgressRepository'`

- [ ] **Step 5: 구현 — `src/repositories/ProgressRepository.ts`**

`recordAttempt`와 `QuestionStats` upsert는 하나의 IndexedDB 트랜잭션으로 묶는다 — 둘 중 하나만 반영되는 상태를 막기 위함이다.

```ts
import { getDb } from "./db";
import type { Attempt, DashboardSummary, QuestionStats } from "@/types/progress";

export interface ProgressRepository {
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(questionId?: string): Promise<Attempt[]>;
  getQuestionStats(questionId: string): Promise<QuestionStats>;
  getDashboardSummary(): Promise<DashboardSummary>;
  addWrongNote(questionId: string): Promise<void>;
  addFavorite(questionId: string): Promise<void>;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class IndexedDbProgressRepository implements ProgressRepository {
  async recordAttempt(attempt: Omit<Attempt, "id">): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["attempts", "questionStats"], "readwrite");

    await tx.objectStore("attempts").add(attempt as Attempt);

    const statsStore = tx.objectStore("questionStats");
    const existing = await statsStore.get(attempt.questionId);
    const next: QuestionStats = existing ?? {
      questionId: attempt.questionId,
      correctCount: 0,
      wrongCount: 0,
      lastSolvedAt: 0,
    };
    if (attempt.isCorrect) {
      next.correctCount += 1;
    } else {
      next.wrongCount += 1;
    }
    next.lastSolvedAt = attempt.solvedAt;
    await statsStore.put(next);

    await tx.done;
  }

  async getAttempts(questionId?: string): Promise<Attempt[]> {
    const db = await getDb();
    if (questionId) {
      return db.getAllFromIndex("attempts", "questionId", questionId);
    }
    return db.getAll("attempts");
  }

  async getQuestionStats(questionId: string): Promise<QuestionStats> {
    const db = await getDb();
    const existing = await db.get("questionStats", questionId);
    return (
      existing ?? {
        questionId,
        correctCount: 0,
        wrongCount: 0,
        lastSolvedAt: 0,
      }
    );
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const attempts = await this.getAttempts();
    const now = Date.now();
    const today = attempts.filter((a) => now - a.solvedAt < ONE_DAY_MS);

    const accuracy = (list: Attempt[]) =>
      list.length === 0 ? 0 : list.filter((a) => a.isCorrect).length / list.length;

    return {
      todayCount: today.length,
      todayAccuracy: accuracy(today),
      totalCount: attempts.length,
      totalAccuracy: accuracy(attempts),
    };
  }

  async addWrongNote(questionId: string): Promise<void> {
    const db = await getDb();
    await db.put("wrongNotes", { questionId, addedAt: Date.now() });
  }

  async addFavorite(questionId: string): Promise<void> {
    const db = await getDb();
    await db.put("favorites", { questionId, addedAt: Date.now() });
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run src/repositories/ProgressRepository.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/types/progress.ts src/repositories/db.ts src/repositories/ProgressRepository.ts src/repositories/ProgressRepository.test.ts
git commit -m "feat: IndexedDB 기반 ProgressRepository"
```

---

### Task 7: QuestionRepository (정적 JSON)

**Files:**
- Create: `src/repositories/QuestionRepository.ts`
- Create: `src/repositories/QuestionRepository.test.ts`

**Interfaces:**
- Consumes: `Question`, `Exam`, `ExamSummary` (Task 2), `makeQuestionId`/`parseQuestionId` (Task 2)
- Produces: `interface QuestionRepository { getQuestion(questionId: string): Promise<Question>; getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]>; }`, `JsonQuestionRepository implements QuestionRepository`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/repositories/QuestionRepository.test.ts`**

`fetch`를 모킹해 `public/data/*.json`을 흉내낸다 — 실제 파일 I/O 없이 계약(fetch한 URL, 합성한 필드)만 검증한다.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JsonQuestionRepository } from "./QuestionRepository";

const examsIndexFixture = [
  { examId: "2023-1", title: "2023년 1회", count: 2 },
  { examId: "2023-2", title: "2023년 2회", count: 1 },
];

const exam2023_1 = {
  examId: "2023-1",
  title: "2023년 1회",
  questions: [
    {
      qnum: 1,
      stem: "1번 문항",
      options: ["a", "b", "c", "d"],
      subject: 1,
      subjectName: "소프트웨어 설계",
      answer: 1,
      explanation: "",
      image: null,
    },
    {
      qnum: 2,
      stem: "2번 문항",
      options: ["a", "b", "c", "d"],
      subject: 2,
      subjectName: "소프트웨어 개발",
      answer: 2,
      explanation: "",
      image: null,
      sinagong: "075",
    },
  ],
};

const exam2023_2 = {
  examId: "2023-2",
  title: "2023년 2회",
  questions: [
    {
      qnum: 1,
      stem: "다른 회차 1번",
      options: ["a", "b", "c", "d"],
      subject: 1,
      subjectName: "소프트웨어 설계",
      answer: 3,
      explanation: "",
      image: null,
    },
  ],
};

function mockFetchJson(url: string) {
  const body = url.includes("exams_index")
    ? examsIndexFixture
    : url.includes("exam_2023-1")
      ? exam2023_1
      : exam2023_2;
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockFetchJson));
});

describe("JsonQuestionRepository", () => {
  it("getQuestion은 examId-Qqnum 형식을 파싱해 해당 문항을 questionId·examId를 채워 반환한다", async () => {
    const repo = new JsonQuestionRepository();
    const q = await repo.getQuestion("2023-1-Q2");

    expect(q.questionId).toBe("2023-1-Q2");
    expect(q.examId).toBe("2023-1");
    expect(q.stem).toBe("2번 문항");
    expect(q.sinagong).toBe("075");
    expect(fetch).toHaveBeenCalledWith("/data/exam_2023-1.json");
  });

  it("getQuestions({ examId })는 해당 회차 문항만 반환한다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ examId: "2023-1" });
    expect(qs).toHaveLength(2);
    expect(qs[0].questionId).toBe("2023-1-Q1");
  });

  it("getQuestions({ examId, subject })는 회차 내 과목까지 필터링한다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ examId: "2023-1", subject: 2 });
    expect(qs).toHaveLength(1);
    expect(qs[0].questionId).toBe("2023-1-Q2");
  });

  it("getQuestions({ subject })만 주어지면 exams_index를 읽어 전체 회차를 뒤진다", async () => {
    const repo = new JsonQuestionRepository();
    const qs = await repo.getQuestions({ subject: 1 });
    expect(qs.map((q) => q.questionId).sort()).toEqual(["2023-1-Q1", "2023-2-Q1"]);
  });

  it("같은 회차를 두 번 요청해도 fetch는 한 번만 일어난다 (캐시)", async () => {
    const repo = new JsonQuestionRepository();
    await repo.getQuestions({ examId: "2023-1" });
    await repo.getQuestions({ examId: "2023-1" });
    const examFetchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) =>
      String(url).includes("exam_2023-1")
    );
    expect(examFetchCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/repositories/QuestionRepository.test.ts
```

Expected: FAIL — `Cannot find module './QuestionRepository'`

- [ ] **Step 3: 구현 — `src/repositories/QuestionRepository.ts`**

원본 JSON의 문항에는 `questionId`/`examId`가 없으므로, 파일을 로드하는 시점에 합성해서 `Question` 타입으로 만든다. 같은 회차를 반복 요청해도 다시 fetch하지 않도록 모듈 레벨에 캐싱한다.

```ts
import { makeQuestionId, parseQuestionId } from "@/lib/questionId";
import type { Exam, ExamSummary, Question } from "@/types/question";

export interface QuestionRepository {
  getQuestion(questionId: string): Promise<Question>;
  getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]>;
}

interface RawQuestion {
  qnum: number;
  stem: string;
  options: string[];
  subject: number;
  subjectName?: string;
  answer: number;
  explanation: string;
  image: string | null;
  sinagong?: string;
}

interface RawExam {
  examId: string;
  title: string;
  questions: RawQuestion[];
}

export class JsonQuestionRepository implements QuestionRepository {
  private examCache = new Map<string, Promise<Question[]>>();
  private indexCache: Promise<ExamSummary[]> | null = null;

  private loadExam(examId: string): Promise<Question[]> {
    let cached = this.examCache.get(examId);
    if (!cached) {
      cached = fetch(`/data/exam_${examId}.json`)
        .then((res) => res.json() as Promise<RawExam>)
        .then((raw) =>
          raw.questions.map(
            (q): Question => ({
              questionId: makeQuestionId(raw.examId, q.qnum),
              examId: raw.examId,
              qnum: q.qnum,
              stem: q.stem,
              options: q.options,
              subject: q.subject,
              answer: q.answer,
              explanation: q.explanation,
              image: q.image,
              sinagong: q.sinagong,
            })
          )
        );
      this.examCache.set(examId, cached);
    }
    return cached;
  }

  private loadIndex(): Promise<ExamSummary[]> {
    if (!this.indexCache) {
      this.indexCache = fetch("/data/exams_index.json").then(
        (res) => res.json() as Promise<ExamSummary[]>
      );
    }
    return this.indexCache;
  }

  async getQuestion(questionId: string): Promise<Question> {
    const { examId, qnum } = parseQuestionId(questionId);
    const questions = await this.loadExam(examId);
    const found = questions.find((q) => q.qnum === qnum);
    if (!found) {
      throw new Error(`문항을 찾을 수 없다: ${questionId}`);
    }
    return found;
  }

  async getQuestions(filter: { examId?: string; subject?: number }): Promise<Question[]> {
    const examIds = filter.examId
      ? [filter.examId]
      : (await this.loadIndex()).map((e) => e.examId);

    const perExam = await Promise.all(examIds.map((id) => this.loadExam(id)));
    const all = perExam.flat();

    return filter.subject === undefined
      ? all
      : all.filter((q) => q.subject === filter.subject);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/repositories/QuestionRepository.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/QuestionRepository.ts src/repositories/QuestionRepository.test.ts
git commit -m "feat: 정적 JSON 기반 QuestionRepository (회차 캐싱)"
```

---

### Task 8: 학습모드 문제풀이 화면

여기서부터는 UI다. 설계문서 8절 방침대로 자동 테스트를 붙이지 않는 대신, Step 마지막에 수동 QA 체크리스트를 둔다.

**Files:**
- Create: `src/features/practice/PracticeSetup.tsx`
- Create: `src/features/practice/QuestionCard.tsx`
- Create: `src/features/practice/PracticeSession.tsx`
- Create: `src/app/practice/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `Question` (Task 2), `pickRandomQuestions` (Task 3), `resolveTheoryLink`, `TheoryMap` (Task 4), `gradeAnswer` (Task 2), `JsonQuestionRepository` (Task 7), `IndexedDbProgressRepository` (Task 6)

- [ ] **Step 1: `theory_map.json`을 정적 임포트로 번들에 포함**

`public/data/theory_map.json`은 빌드 시점에 없을 수도 있는 복사본이라(`npm run data` 실행 여부에 좌우), 소스에서 직접 참조할 수 없다. 대신 `public/data/theory_map.json`을 **fetch로** 읽는다 — `QuestionRepository`와 같은 방식이라 일관적이다.

`src/features/practice/PracticeSetup.tsx` 작성:

```tsx
"use client";

import { useState } from "react";
import { SUBJECT_NAMES } from "@/lib/theory";

export interface PracticeSetupValue {
  subject: number | "all";
  count: 20 | 40 | 100;
}

interface PracticeSetupProps {
  onStart: (value: PracticeSetupValue) => void;
}

export function PracticeSetup({ onStart }: PracticeSetupProps) {
  const [subject, setSubject] = useState<number | "all">("all");
  const [count, setCount] = useState<20 | 40 | 100>(20);

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold">학습모드 문제풀이</h1>

      <div className="flex flex-col gap-2">
        <span className="font-medium">과목</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubject("all")}
            className={`px-3 py-1.5 rounded border ${subject === "all" ? "bg-black text-white" : ""}`}
          >
            통합
          </button>
          {Object.entries(SUBJECT_NAMES).map(([num, name]) => (
            <button
              key={num}
              type="button"
              onClick={() => setSubject(Number(num))}
              className={`px-3 py-1.5 rounded border ${subject === Number(num) ? "bg-black text-white" : ""}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium">문항수</span>
        <div className="flex gap-2">
          {([20, 40, 100] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`px-3 py-1.5 rounded border ${count === n ? "bg-black text-white" : ""}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onStart({ subject, count })}
        className="mt-4 px-4 py-2 rounded bg-blue-600 text-white font-medium"
      >
        시작
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `src/features/practice/QuestionCard.tsx` 작성**

문항 표시, 선택지, 채점 결과(학습모드라 즉시 표시), 관련이론 링크를 담당한다. 부모(`PracticeSession`)가 채점 여부·선택값을 들고 있고 이 컴포넌트는 표시만 한다(설계문서 4절 원칙 3).

```tsx
"use client";

import type { Question } from "@/types/question";
import type { TheoryLink } from "@/types/theory";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  selectedAnswer: number | null;
  theoryLink: TheoryLink | null;
  onSelect: (answer: number) => void;
}

export function QuestionCard({
  question,
  index,
  total,
  selectedAnswer,
  theoryLink,
  onSelect,
}: QuestionCardProps) {
  const isGraded = selectedAnswer !== null;
  const isCorrect = isGraded && selectedAnswer === question.answer;

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-4">
      <div className="text-sm text-gray-500">
        {index + 1} / {total}
      </div>

      <p className="text-lg font-medium whitespace-pre-wrap">{question.stem}</p>

      {question.image && (
        <img src={`/data/${question.image}`} alt="문항 이미지" className="max-w-full rounded border" />
      )}

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const optionNumber = i + 1;
          const isSelected = selectedAnswer === optionNumber;
          const isAnswer = optionNumber === question.answer;

          let style = "border-gray-300";
          if (isGraded && isAnswer) style = "border-green-600 bg-green-50";
          else if (isGraded && isSelected && !isAnswer) style = "border-red-600 bg-red-50";
          else if (isSelected) style = "border-blue-600";

          return (
            <button
              key={optionNumber}
              type="button"
              disabled={isGraded}
              onClick={() => onSelect(optionNumber)}
              className={`text-left px-3 py-2 rounded border ${style}`}
            >
              {optionNumber}. {option}
            </button>
          );
        })}
      </div>

      {isGraded && (
        <div className="flex flex-col gap-2 mt-2 p-3 rounded bg-gray-50">
          <p className={isCorrect ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
            {isCorrect ? "정답" : "오답"}
          </p>
          <p className="text-sm whitespace-pre-wrap">{question.explanation}</p>
          {theoryLink && (
            <p className="text-sm text-blue-700">
              관련 이론: {theoryLink.label} (p.{theoryLink.page})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `src/features/practice/PracticeSession.tsx` 작성 (세션 상태 + 키보드)**

키보드: `1`~`4` 즉시 채점, `Space` 다음 문제, `←`/`→` 이전/다음 문제(설계문서 5절). `Enter`는 쓰지 않는다.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionCard } from "./QuestionCard";
import { gradeAnswer } from "@/lib/grading";
import { resolveTheoryLink } from "@/lib/theory";
import { IndexedDbProgressRepository } from "@/repositories/ProgressRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

interface PracticeSessionProps {
  questions: Question[];
  theoryMap: TheoryMap;
  onFinish: () => void;
}

const progressRepository = new IndexedDbProgressRepository();

export function PracticeSession({ questions, theoryMap, onFinish }: PracticeSessionProps) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());

  const question = questions[current];
  const selectedAnswer = answers[current] ?? null;
  const theoryLink = useMemo(
    () => resolveTheoryLink(question, theoryMap),
    [question, theoryMap]
  );

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setCurrent(nextIndex);
    setQuestionStartedAt(Date.now());
  }

  function select(answer: number) {
    if (selectedAnswer !== null) return;
    setAnswers((prev) => ({ ...prev, [current]: answer }));

    const isCorrect = gradeAnswer(question, answer);
    void progressRepository.recordAttempt({
      questionId: question.questionId,
      solvedAt: Date.now(),
      mode: "study",
      selectedAnswer: answer,
      isCorrect,
      solveTimeMs: Date.now() - questionStartedAt,
    });
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["1", "2", "3", "4"].includes(e.key)) {
        select(Number(e.key));
      } else if (e.key === " ") {
        e.preventDefault();
        if (current === questions.length - 1) {
          onFinish();
        } else {
          goTo(current + 1);
        }
      } else if (e.key === "ArrowRight") {
        goTo(current + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(current - 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col gap-4">
      <QuestionCard
        question={question}
        index={current}
        total={questions.length}
        selectedAnswer={selectedAnswer}
        theoryLink={selectedAnswer !== null ? theoryLink : null}
        onSelect={select}
      />
      <div className="max-w-xl mx-auto w-full flex justify-between px-6 text-sm text-gray-500">
        <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0}>
          ← 이전
        </button>
        <span>Space: 다음 · 1~4: 답 선택</span>
        {current === questions.length - 1 ? (
          <button type="button" onClick={onFinish} className="text-blue-700 font-medium">
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
```

- [ ] **Step 4: `src/app/practice/page.tsx` 작성 (라우트, 데이터 로딩, Setup↔Session 전환)**

```tsx
"use client";

import { useState } from "react";
import { PracticeSetup, type PracticeSetupValue } from "@/features/practice/PracticeSetup";
import { PracticeSession } from "@/features/practice/PracticeSession";
import { pickRandomQuestions } from "@/lib/sampling";
import { JsonQuestionRepository } from "@/repositories/QuestionRepository";
import type { Question } from "@/types/question";
import type { TheoryMap } from "@/types/theory";

const questionRepository = new JsonQuestionRepository();

type Phase =
  | { kind: "setup" }
  | { kind: "loading" }
  | { kind: "active"; questions: Question[]; theoryMap: TheoryMap }
  | { kind: "done" };

export default function PracticePage() {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

  async function start(value: PracticeSetupValue) {
    setPhase({ kind: "loading" });

    const [pool, theoryMap] = await Promise.all([
      questionRepository.getQuestions(
        value.subject === "all" ? {} : { subject: value.subject }
      ),
      fetch("/data/theory_map.json").then((res) => res.json() as Promise<TheoryMap>),
    ]);

    const questions = pickRandomQuestions(pool, value.count);
    setPhase({ kind: "active", questions, theoryMap });
  }

  if (phase.kind === "setup") {
    return <PracticeSetup onStart={start} />;
  }

  if (phase.kind === "loading") {
    return <p className="text-center p-10">문제 불러오는 중...</p>;
  }

  if (phase.kind === "done") {
    return (
      <div className="text-center p-10 flex flex-col gap-4 items-center">
        <p className="text-lg font-medium">수고했다.</p>
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
      onFinish={() => setPhase({ kind: "done" })}
    />
  );
}
```

- [ ] **Step 5: 홈에서 진입 링크 추가**

`src/app/page.tsx`를 읽어 create-next-app 기본 내용을 걷어내고 진입 링크만 남긴다.

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">PassFlow</h1>
      <Link
        href="/practice"
        className="px-6 py-3 rounded bg-blue-600 text-white font-medium"
      >
        문제풀이 시작 (학습모드)
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```

Expected: 에러 없이 통과, `/practice` 라우트가 목록에 나타남.

- [ ] **Step 7: 수동 QA (설계문서 8절 — UI는 Phase 1에서 자동 테스트 대상이 아니므로 여기서 직접 확인한다)**

```bash
npm run data
npm run dev
```

`http://localhost:3000`에서:

1. "문제풀이 시작" 클릭 → 과목/문항수 선택 화면이 뜬다
2. 과목 "통합", 문항수 "20" 선택 → 시작 → 문제가 뜬다
3. 키보드 `1` 눌러 채점 → 정답/오답 표시 + 해설 + "관련 이론: ..." 문구가 뜬다
   - **sinagong 있는 문항**에서 이론명이 정상 문구로 뜨는지 확인 (예: "스택(Stack)")
   - 이론명이 `(`로 시작하는 등 깨진 케이스가 나오지 않는지 확인(과목명으로 대체됐는지)
4. `Space` → 다음 문항으로 넘어간다
5. `←` → 이전 문항으로 돌아가면 이미 고른 답과 채점 결과가 그대로 보인다(다시 클릭 안 먹는지도 확인)
6. 이미지가 있는 문항(아무 회차나 여러 번 다시 시작하며 만날 때까지, 또는 브라우저 개발자도구 Network 탭에서 `/data/images/` 요청이 200인지 직접 확인)이 나오면 이미지가 깨지지 않고 뜨는지 확인
7. 마지막 문항까지 가서 "종료" → "수고했다" 화면
8. 브라우저 개발자도구 Application → IndexedDB → `passflow` → `attempts`에 방금 푼 문항 수만큼 레코드가 쌓였는지 확인, `questionStats`에도 문항별 집계가 있는지 확인

전부 통과하면 다음 단계로. 하나라도 깨지면 해당 스텝으로 돌아가 원인을 고친다(빌드가 통과했다고 동작을 보장하지 않는다).

- [ ] **Step 8: Commit**

```bash
git add src/features/practice src/app/practice src/app/page.tsx
git commit -m "feat: 학습모드 랜덤 문제풀이 화면"
```

---

## Self-Review 결과

**Spec coverage**: 3.1(문제 타입)→Task 2, 3.2(Attempt/QuestionStats/Progress interface)→Task 6, 3.3(관련이론)→Task 4, 4절(Repository 인터페이스 고정)→Task 6·7, 5절(랜덤 진입/학습모드/키보드/오답 시 이론보기)→Task 8, 8절(Vitest, 순수함수만 테스트)→Task 1·2·3·4·5·6·7. 시험모드/회차별진입/복습/리포트/Dashboard 화면/설정은 상단 "Scope 결정"에 후속 계획으로 명시.

**Placeholder scan**: 전체 재확인 — "TODO"/"나중에"/"적절히 처리" 패턴 없음. `getDashboardSummary`는 Dashboard 화면이 없어도 완전히 구현(설계문서가 Phase 1 인터페이스로 고정했으므로).

**Type consistency**: `Question`(Task 2) → Task 3·4·6·7·8에서 동일 필드로 소비. `TheoryMap`/`TheoryLink`(Task 4) → Task 8에서 동일 시그니처로 소비. `ProgressRepository`(Task 6) 인터페이스 메서드명이 설계문서 143~158행과 정확히 일치. `QuestionRepository`(Task 7) 동일.
