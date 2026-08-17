import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { gradeAnswer } from "@/lib/grading";
import type { SubmitAnswerItem, SubmitResult } from "@/types/question";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

export async function POST(
  request: Request,
  context: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await context.params;
    const body = (await request.json()) as { answers?: SubmitAnswerItem[] };

    if (!Array.isArray(body.answers)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const results = body.answers.map(({ questionId, selectedAnswer }) => {
      const question = repo.getQuestion(questionId);
      const correct = gradeAnswer(question, selectedAnswer);
      return {
        questionId,
        correct,
        correctAnswer: question.answer,
        explanation: question.explanation,
      };
    });

    const solved = results.length;
    const correct = results.filter((r) => r.correct).length;
    const response: SubmitResult = {
      results,
      total: solved,
      solved,
      correct,
      wrong: solved - correct,
    };

    return NextResponse.json(response);
  } catch (err) {
    return handleApiError(err);
  }
}
