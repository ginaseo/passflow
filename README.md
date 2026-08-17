# PassFlow

자격증 필기 CBT 웹앱. 기출문제 풀이 · 오답노트 · 학습 리포트. 정보처리기사 · SQLD 등 여러 자격증을 하나의 앱에서 전환해가며 쓴다.

## 상태

**v2 — Private API + 서버 배포.** 문제 데이터는 서버에서만 읽고, API를 통해 정답 없이 전달한다. 채점은 서버에서 수행한다. 풀이 기록·설정·오답노트는 브라우저 IndexedDB(불가 시 localStorage 폴백)에 쌓는다.

- **자격증 선택**: 설정에서 자격증 전환(정처기/SQLD), 자격증별로 문제·진행기록 분리
- **문제풀이**: 학습모드(즉시채점) · 시험모드(회차 전체 응시, 자격증별 실제 시험 비율로 제한시간 자동계산 또는 제한없음, 과락/합격 판정). 랜덤 진입 시 서버에서 과목 비율 배분 추출.
- **복습**: 오답노트 · 즐겨찾기 · 최근 푼 문제, 다시풀기(순차/랜덤 설정 가능)
- **대시보드**: 오늘/전체 통계, CBT 응시 기록 전체(회차별 과목 점수·응시일시·미완료 세션 표시)
- **설정**: 오답 자동저장, 기본 모드, 시간초과 처리, 데이터 백업 내보내기/가져오기, 전체 초기화
- **접근 제어**: shared secret (접근 키)로 API 보호

## 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PWA

## 실행

```bash
npm install
```

`.env.local` 예시:

```env
PASSFLOW_DATA_DIR=C:/CompWork/passflow-data/data
PASSFLOW_ACCESS_KEY=로컬테스트용비밀번호
```

```bash
npm run dev
```

http://localhost:3000 — 첫 접속 시 접근 키 입력.

## 문제 데이터

문제 JSON은 Private repo `passflow-data`에 있다. 서버는 `PASSFLOW_DATA_DIR`에서 직접 읽는다.

로컬: `passflow-data`를 clone하고 `PASSFLOW_DATA_DIR`을 `data/` 하위로 지정.

배포(Render): build 시 `scripts/fetch-data.mjs`가 private repo를 clone한다. `PASSFLOW_DATA_TOKEN` 필요.

레거시 `npm run data` (`public/data/` 복사)는 v2에서 사용하지 않는다.

## 구조

```
src/app/          라우트 + API Route Handlers
src/features/     기능 단위 폴더 (layout, nav, practice, review)
src/lib/          비즈니스 로직 — 순수 함수
src/repositories/ ApiQuestionRepository (client) + FsQuestionRepository (server) + IndexedDB
scripts/          fetch-data.mjs (배포), copy-data.mjs (레거시)
```

## Render 배포

Build: `npm ci && node scripts/fetch-data.mjs && npm run build`

Start: `npm run start`

Environment Variables:

| 변수 | 설명 |
|------|------|
| `PASSFLOW_DATA_TOKEN` | GitHub PAT (passflow-data Contents: Read) |
| `PASSFLOW_DATA_REPO` | `https://github.com/ginaseo/passflow-data.git` |
| `PASSFLOW_DATA_DIR` | `.passflow-data/data` |
| `PASSFLOW_ACCESS_KEY` | 접근 키 (shared secret) |

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 테스트 |
| `npm run fetch-data` | Private repo clone (배포/로컬) |
| `npm run data` | 레거시 — public/data 복사 (v1) |
