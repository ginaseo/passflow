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
    const body = (await request.json()) as { answer?: number | number[] };

    const isValidAnswer =
      Number.isInteger(body.answer) ? (body.answer as number) >= 1
        : Array.isArray(body.answer) && body.answer.length > 0 && body.answer.every((n) => Number.isInteger(n) && n >= 1);

    if (!isValidAnswer) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const question = repo.getQuestion(decodedId);
    const correct = gradeAnswer(question, body.answer as number | number[]);

    return NextResponse.json({
      correct,
      correctAnswer: question.answer,
      explanation: question.explanation,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
