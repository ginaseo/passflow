import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, isAccessKeyConfigured, verifyAccessCookieValue } from "@/lib/apiAuth";

// robots.txt는 권고일 뿐 강제력 없음 — AI 학습 크롤러 UA는 여기서 이중 차단.
const BLOCKED_UA_PATTERN =
  /GPTBot|ChatGPT-User|CCBot|anthropic-ai|ClaudeBot|Claude-Web|Google-Extended|Applebot-Extended|PerplexityBot|cohere-ai|Bytespider|meta-externalagent/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent") ?? "";

  if (BLOCKED_UA_PATTERN.test(userAgent)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname === "/api/unlock") {
    return NextResponse.next();
  }

  if (!isAccessKeyConfigured()) {
    // 로컬 개발 편의를 위해 키 미설정 시 인증을 건너뛴다 — 다만 운영 배포에서
    // PASSFLOW_ACCESS_KEY 설정을 빠뜨리면 채점 API가 정답/해설을 인증 없이
    // 노출하게 되므로, production에서는 fail-open 대신 막는다.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!(await verifyAccessCookieValue(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
