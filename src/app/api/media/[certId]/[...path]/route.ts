import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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
    if (!path?.length) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const root = getServerDataDir();
    const filePath = join(root, certId, "images", ...path);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
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
