import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { toPublicQuestions } from "@/lib/questionSanitize";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ certId: string; examId: string }> }
) {
  try {
    const { certId, examId } = await context.params;
    const repo = getFsQuestionRepository(certId);
    const questions = repo.getQuestions({ examId });
    return NextResponse.json(toPublicQuestions(questions));
  } catch (err) {
    return handleApiError(err);
  }
}
