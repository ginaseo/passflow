import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { gradeAnswer } from "@/lib/grading";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ certId: string; questionId: string }> }
) {
  try {
    const { certId, questionId } = await context.params;
    const decodedId = decodeURIComponent(questionId);
    const body = (await request.json()) as { answer?: number };

    if (body.answer === undefined || !Number.isInteger(body.answer) || body.answer < 1) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const question = repo.getQuestion(decodedId);
    const correct = gradeAnswer(question, body.answer);

    return NextResponse.json({
      correct,
      correctAnswer: question.answer,
      explanation: question.explanation,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
