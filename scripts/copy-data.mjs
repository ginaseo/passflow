// 문제 데이터를 가져온다. 원본 JSON을 public/data/로 복사한다.
// 원본 위치는 .env.local의 PASSFLOW_DATA_DIR로 지정한다.
import { readdirSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = process.env.PASSFLOW_DATA_DIR;
if (!SRC) {
  console.error("PASSFLOW_DATA_DIR이 없다. .env.local에 원본 디렉토리 경로를 지정한다.");
  process.exit(1);
}

const DEST = resolve("public/data");

let names;
try {
  names = readdirSync(SRC);
} catch {
  console.error(`원본 디렉토리를 열 수 없다: ${SRC}`);
  process.exit(1);
}

// `_`로 시작하는 파일은 작업용 산출물이라 앱에 넣지 않는다.
const targets = names.filter((n) => n.endsWith(".json") && !n.startsWith("_"));
if (targets.length === 0) {
  console.error(`복사할 JSON이 없다: ${SRC}`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const name of targets) {
  copyFileSync(join(SRC, name), join(DEST, name));
}

console.log(`${targets.length}개 JSON을 ${DEST}로 복사했다.`);
