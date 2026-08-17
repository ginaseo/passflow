import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { getFsQuestionRepository } from "@/repositories/FsQuestionRepository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await context.params;
    const repo = getFsQuestionRepository(certId);
    return NextResponse.json(repo.getMetadata());
  } catch (err) {
    return handleApiError(err);
  }
}
