# PassFlow

정보처리기사 필기 CBT 웹앱. 기출문제 풀이 · 오답노트 · 학습 리포트.

## 상태

**v1(MVP) 완성.** 백엔드 없이 동작한다 — 문제는 정적 JSON으로 읽고, 풀이 기록·설정·오답노트는 브라우저 IndexedDB(불가 시 localStorage 폴백)에 쌓는다. 개인 학습 도구로는 이 상태로 완결.

- **문제풀이**: 학습모드(즉시채점) · 시험모드(회차 전체 응시, 시간제한, 과락/합격 판정). 랜덤 진입 시 과목별 균등추출.
- **복습**: 오답노트 · 즐겨찾기 · 최근 푼 문제, 다시풀기(순차/랜덤 설정 가능)
- **대시보드**: 오늘/전체 통계, CBT 응시 기록 전체(회차별 과목 점수·응시일시·미완료 세션 표시)
- **설정**: 오답 자동저장, 기본 모드, 시간초과 처리, 데이터 백업 내보내기/가져오기, 전체 초기화

여러 사용자가 실제로 쓰게 배포하려면(v2), 문제은행을 클라이언트에 통째로 내려보내는 지금 구조로는 노출을 막을 수 없다 — 문제를 한 번에 하나씩만 서버가 내려주고 채점도 서버에서 하는 백엔드가 필요하다. 지금은 이 상태로 개인용/로컬로만 쓴다.

## 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PWA

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000

## 문제 데이터

문제 JSON은 이 repo에 없다(`/public/data/`는 gitignore 대상). `.env.local`에 `PASSFLOW_DATA_DIR`로 원본 디렉토리를 지정하고 아래를 실행하면 복사된다:

```bash
npm run data
```

## 구조

```
src/app/          라우트 (App Router) — /, /practice, /review, /dashboard, /settings
src/features/     기능 단위 폴더 (layout, nav, practice, review)
src/lib/          비즈니스 로직 — 순수 함수, UI·저장소에 의존하지 않는다
src/repositories/ 데이터 접근 (JSON + IndexedDB, localStorage 폴백)
scripts/          개발용 스크립트
```

UI는 표시만 하고, 로직은 `src/lib`에, 데이터 접근은 Repository 인터페이스 뒤에 둔다. v2에서 JSON을 API로 바꿀 때 구현체만 교체하고 UI는 건드리지 않기 위한 경계다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 테스트 |
| `npm run data` | 문제 데이터 동기화 (`PASSFLOW_DATA_DIR` → `public/data/`) |
