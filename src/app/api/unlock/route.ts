import { NextResponse } from "next/server";
import { accessCookieOptions, createAccessCookieValue, verifyUnlockKey } from "@/lib/apiAuth";
import { apiError } from "@/lib/apiError";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
    if (!body.key || typeof body.key !== "string") {
      return apiError("Bad request", 400);
    }

    if (!verifyUnlockKey(body.key)) {
      return apiError("Unauthorized", 401);
    }

    const cookieValue = await createAccessCookieValue();
    const response = NextResponse.json({ ok: true });
    if (cookieValue) {
      response.cookies.set("pf_access", cookieValue, accessCookieOptions());
    }
    return response;
  } catch {
    return apiError("Bad request", 400);
  }
}
