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
    const body = (await request.json()) as { questionIds?: string[] };

    if (!Array.isArray(body.questionIds) || body.questionIds.length === 0) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const questions = repo.getQuestionsByIds(body.questionIds);
    return NextResponse.json(toPublicQuestions(questions));
  } catch (err) {
    return handleApiError(err);
  }
}
