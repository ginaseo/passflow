import { NextResponse } from "next/server";

export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message.includes("not found") || err.message.includes("찾을 수 없")) {
      return apiError("Not found", 404);
    }
    if (err.message.includes("not configured") || err.message.includes("not available")) {
      return apiError("Service unavailable", 500);
    }
  }
  return apiError("Internal server error", 500);
}
