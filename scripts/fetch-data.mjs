import { execFileSync } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const CERT_LABELS = {
  jcg: "정보처리기사",
  sqld: "SQLD",
};

function readEnvFileValue(key, filePath) {
  if (!existsSync(filePath)) return undefined;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== key) continue;
    return trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const envFileValue = readEnvFileValue("PASSFLOW_DATA_DIR", resolve(".env.local"));
const DEST = resolve(envFileValue ?? process.env.PASSFLOW_DATA_DIR ?? ".passflow-data/data");
const REPO = process.env.PASSFLOW_DATA_REPO ?? "https://github.com/ginaseo/passflow-data.git";
const TOKEN = process.env.PASSFLOW_DATA_TOKEN;
const CLONE_DIR = resolve(".passflow-data/repo");

function copyCertDataset(srcDir, destDir) {
  let names;
  try {
    names = readdirSync(srcDir);
  } catch {
    return null;
  }

  const targets = names.filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  if (targets.length === 0) return null;

  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const imagesSrc = join(srcDir, "images");
  let imageCount = 0;
  if (existsSync(imagesSrc)) {
    cpSync(imagesSrc, join(destDir, "images"), { recursive: true });
    imageCount = readdirSync(imagesSrc).length;
  }

  const isStandardDataset =
    targets.includes("exams_index.json") && targets.some((name) => name.startsWith("exam_"));

  if (isStandardDataset) {
    for (const name of targets) {
      copyFileSync(join(srcDir, name), join(destDir, name));
    }
    if (!targets.includes("theory_map.json")) {
      writeFileSync(join(destDir, "theory_map.json"), "{}\n");
    }
    return { examCount: targets.filter((n) => n.startsWith("exam_")).length, imageCount };
  }

  const examSummaries = [];
  for (const name of targets) {
    const srcPath = join(srcDir, name);
    const raw = JSON.parse(readFileSync(srcPath, "utf8"));
    const examId = String(raw.examId ?? basename(name, ".json"));
    const title = String(raw.title ?? examId);
    const questions = Array.isArray(raw.questions) ? raw.questions : [];

    copyFileSync(srcPath, join(destDir, `exam_${examId}.json`));
    examSummaries.push({ examId, title, count: questions.length });
  }

  writeFileSync(join(destDir, "exams_index.json"), `${JSON.stringify(examSummaries, null, 2)}\n`);
  writeFileSync(join(destDir, "theory_map.json"), "{}\n");

  return { examCount: examSummaries.length, imageCount };
}

function cloneRepo() {
  rmSync(CLONE_DIR, { recursive: true, force: true });
  mkdirSync(resolve(".passflow-data"), { recursive: true });

  // 토큰을 clone URL에 심으면 .git/config의 remote.origin.url과 clone 실패 시
  // 에러 출력에 그대로 남는다 — 대신 이 clone에만 적용되는 extraheader로 넘겨서
  // 자격 증명이 어디에도 저장되지 않게 한다. execFileSync는 REPO 값에 셸
  // 메타문자가 섞여 있어도 인자로만 취급해 셸 인젝션을 막는다.
  const args = ["clone", "--depth", "1"];
  if (TOKEN && REPO.startsWith("https://")) {
    const basicAuth = Buffer.from(`x-access-token:${TOKEN}`).toString("base64");
    args.push("-c", `http.extraheader=AUTHORIZATION: basic ${basicAuth}`);
  }
  args.push(REPO, CLONE_DIR);

  console.log("Cloning private question data repository...");
  execFileSync("git", args, {
    stdio: "inherit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

function normalizeFromClone() {
  const srcRoot = join(CLONE_DIR, "data");
  if (!existsSync(srcRoot)) {
    console.error("Cloned repository does not contain a data/ directory.");
    process.exit(1);
  }

  rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });

  const certDirs = readdirSync(srcRoot).filter((name) => statSync(join(srcRoot, name)).isDirectory());
  const certs = [];

  for (const certId of certDirs) {
    const result = copyCertDataset(join(srcRoot, certId), join(DEST, certId));
    if (!result) continue;
    certs.push({ id: certId, label: CERT_LABELS[certId] ?? certId });
    console.log(`[${certId}] ${result.examCount} exam file(s), ${result.imageCount} image(s).`);
  }

  if (certs.length === 0) {
    console.error("No cert dataset found in cloned repository.");
    process.exit(1);
  }

  writeFileSync(join(DEST, "certs.json"), `${JSON.stringify(certs, null, 2)}\n`);
  console.log(`Normalized ${certs.length} cert dataset(s) to ${DEST}.`);
}

if (TOKEN) {
  try {
    cloneRepo();
    normalizeFromClone();
  } finally {
    // clone 또는 정규화가 실패해도 토큰 헤더가 박힌 .git/config가 남지 않게 한다.
    rmSync(CLONE_DIR, { recursive: true, force: true });
  }
} else if (existsSync(DEST)) {
  console.log(`PASSFLOW_DATA_TOKEN not set; using existing data at ${DEST}.`);
} else {
  console.error("PASSFLOW_DATA_TOKEN is required when data directory does not exist yet.");
  process.exit(1);
}
