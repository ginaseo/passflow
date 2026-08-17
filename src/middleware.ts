import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, isAccessKeyConfigured, verifyAccessCookieValue } from "@/lib/apiAuth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname === "/api/unlock") {
    return NextResponse.next();
  }

  if (!isAccessKeyConfigured()) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!(await verifyAccessCookieValue(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
