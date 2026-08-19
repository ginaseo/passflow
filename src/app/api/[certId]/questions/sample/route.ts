import { NextResponse } from "next/server";
import { getSubjectWeights } from "@/lib/examSubjectWeights";
import { handleApiError } from "@/lib/apiError";
import { pickRandomQuestions, pickSequentialQuestions, pickStratifiedRandomQuestions } from "@/lib/sampling";
import { toPublicQuestions } from "@/lib/questionSanitize";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";
import type { Question } from "@/types/question";

export async function POST(
  request: Request,
  context: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await context.params;
    const body = (await request.json()) as {
      examIds?: string[];
      subject?: number | "all";
      count?: number;
      order?: "random" | "sequential";
      stratified?: boolean;
    };

    if (!body.count || body.count < 1) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const repo = getFsQuestionRepository(certId);
    const order = body.order ?? "random";

    let pool: Question[];
    if (body.examIds && body.examIds.length > 0) {
      pool = repo.getQuestions({ examIds: body.examIds });
    } else if (body.subject !== undefined && body.subject !== "all") {
      pool = repo.getQuestions({ subject: body.subject });
    } else {
      pool = repo.getQuestions({});
    }

    const count = Math.min(body.count, pool.length);
    let picked: Question[];

    if (order === "sequential") {
      picked = pickSequentialQuestions(pool, count);
    } else if (body.stratified !== false && (body.subject === "all" || body.subject === undefined)) {
      picked = pickStratifiedRandomQuestions(pool, count, Math.random, getSubjectWeights(certId));
    } else {
      picked = pickRandomQuestions(pool, count);
    }

    return NextResponse.json(toPublicQuestions(picked));
  } catch (err) {
    return handleApiError(err);
  }
}
