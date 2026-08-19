import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { toPublicQuestions } from "@/lib/questionSanitize";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

// 실사용(오답노트/즐겨찾기 배치조회)은 많아야 수백 건이다 — 상한이 없으면 큰
// 배열 하나로 서버가 시험 파일들을 동기 순회하며 오래 붙잡힐 수 있다.
const MAX_BATCH_SIZE = 500;

export async function POST(
  request: Request,
  context: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await context.params;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    if (typeof json !== "object" || json === null) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const questionIds = (json as { questionIds?: unknown }).questionIds;

    if (
      !Array.isArray(questionIds) ||
      questionIds.length === 0 ||
      questionIds.length > MAX_BATCH_SIZE ||
      !questionIds.every((id) => typeof id === "string")
    ) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const questions = repo.getQuestionsByIds(questionIds);
    return NextResponse.json(toPublicQuestions(questions));
  } catch (err) {
    return handleApiError(err);
  }
}
