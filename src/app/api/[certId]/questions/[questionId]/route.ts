import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { toPublicQuestion } from "@/lib/questionSanitize";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ certId: string; questionId: string }> }
) {
  try {
    const { certId, questionId } = await context.params;
    const decodedId = decodeURIComponent(questionId);
    const repo = getFsQuestionRepository(certId);
    const question = repo.getQuestion(decodedId);
    return NextResponse.json(toPublicQuestion(question));
  } catch (err) {
    return handleApiError(err);
  }
}
