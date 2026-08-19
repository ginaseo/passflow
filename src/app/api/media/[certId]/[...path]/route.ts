import { readFileSync, existsSync } from "node:fs";
import { join, resolve, relative, extname } from "node:path";
import { NextResponse } from "next/server";
import { getServerDataDir } from "@/lib/serverDataPath";
import { handleApiError } from "@/lib/apiError";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
    _request: Request,
    context: { params: Promise<{ certId: string; path: string[] }> }
) {
  try {
    const { certId, path } = await context.params;

    if (!certId || !path?.length) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const root = resolve(getServerDataDir());
    const certRoot = resolve(join(root, certId));

    // certId 자체가 "."/".."/구분자를 포함해 데이터 루트 밖으로 나가지 못하게 막는다 —
    // 아래 filePath 검사만으로는 certRoot가 root의 부모(certId=".."일 때)가 될 수 있어
    // 그 안의 임의 파일이 뚫린다.
    const certRelative = relative(root, certRoot);
    if (certRelative === "" || certRelative.startsWith("..") || resolve(certRoot) === root) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const filePath = resolve(join(certRoot, ...path));

    // certId 디렉터리 밖으로 탈출하는 경로 차단
    if (filePath !== certRoot && !filePath.startsWith(`${certRoot}\\`) && !filePath.startsWith(`${certRoot}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    const data = readFileSync(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        // PASSFLOW_ACCESS_KEY가 설정되면 이 응답은 인증된 사용자 전용이다 — public이면
        // CDN/공유 프록시가 인증 없이 재사용할 수 있어 private로 캐시 범위를 제한한다.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
