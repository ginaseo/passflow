import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { toPublicQuestions } from "@/lib/questionSanitize";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

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
