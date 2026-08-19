import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiError";
import { listCertificates } from "@/repositories/FsQuestionRepository";

export async function GET() {
  try {
    return NextResponse.json(listCertificates());
  } catch (err) {
    return handleApiError(err);
  }
}
