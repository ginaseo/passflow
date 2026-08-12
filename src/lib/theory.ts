import type { Question } from "@/types/question";
import type { TheoryLink, TheoryMap } from "@/types/theory";

export const SUBJECT_NAMES: Record<number, string> = {
  1: "1과목 소프트웨어 설계",
  2: "2과목 소프트웨어 개발",
  3: "3과목 데이터베이스 구축",
  4: "4과목 프로그래밍 언어 활용",
  5: "5과목 정보시스템 구축 관리",
};

// data/theory_map.json 376개 항목을 subject별로 실측한 최소 page 값 (2026-07-30 기준).
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

// 문항 자체에 실려오는 subjectName이 자격증별 실제 과목명이다(정처기는 SUBJECT_NAMES와 동일
// 텍스트, SQLD 등 다른 자격증은 과목 구성이 다르므로 SUBJECT_NAMES를 그대로 쓰면 틀린다).
export function getSubjectLabel(question: Pick<Question, "subject" | "subjectName">): string {
  // SUBJECT_NAMES(정처기 하드코딩 폴백)는 이미 "N과목 " 접두사를 포함하고 있어 그대로 쓴다 —
  // subjectName(문항에 실려오는 실제 과목명)은 접두사가 없어 여기서 붙여야 한다.
  if (question.subjectName) return `${question.subject}과목 ${question.subjectName}`;
  return SUBJECT_NAMES[question.subject] ?? `${question.subject}과목`;
}

export function resolveTheoryLink(question: Question, theoryMap: TheoryMap): TheoryLink {
  const subjectName = getSubjectLabel(question);

  if (question.sinagong) {
    const entry = theoryMap[question.sinagong];
    if (entry) {
      const label = isTheoryNameTruncated(entry.name) ? subjectName : entry.name;
      return { label, page: entry.page };
    }
  }

  return { label: subjectName, page: SUBJECT_START_PAGES[question.subject] };
}
