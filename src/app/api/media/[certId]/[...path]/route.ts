import { readFileSync, existsSync } from "node:fs";
import { join, resolve, extname } from "node:path";
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
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
