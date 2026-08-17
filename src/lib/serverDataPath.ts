import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function getServerDataDir(): string {
  const dir = process.env.PASSFLOW_DATA_DIR;
  if (!dir) {
    throw new Error("PASSFLOW_DATA_DIR is not configured");
  }
  const resolved = resolve(dir);
  if (!existsSync(resolved)) {
    throw new Error("Question data directory is not available");
  }
  return resolved;
}
