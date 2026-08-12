import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

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
const SRC = envFileValue ?? process.env.PASSFLOW_DATA_DIR;
if (!SRC) {
  console.error("PASSFLOW_DATA_DIR is not set. Configure .env.local first.");
  process.exit(1);
}

const resolvedSRC = resolve(SRC);
const DEST = resolve("public/data");

// ponytail: only 2 certs today, add a label here when a new cert folder shows up.
const CERT_LABELS = {
  jcg: "정보처리기사",
  sqld: "SQLD",
};

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

  const isStandardDataset = targets.includes("exams_index.json") && targets.some((name) => name.startsWith("exam_"));

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

let certDirs;
try {
  certDirs = readdirSync(resolvedSRC).filter((name) => statSync(join(resolvedSRC, name)).isDirectory());
} catch {
  console.error(`Cannot read source directory: ${resolvedSRC}`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

const certs = [];
for (const certId of certDirs) {
  const result = copyCertDataset(join(resolvedSRC, certId), join(DEST, certId));
  if (!result) continue;
  certs.push({ id: certId, label: CERT_LABELS[certId] ?? certId });
  console.log(`[${certId}] ${result.examCount} exam file(s), ${result.imageCount} image(s).`);
}

if (certs.length === 0) {
  console.error(`No cert dataset found under ${resolvedSRC}. Each cert needs its own subfolder with exam JSON files.`);
  process.exit(1);
}

writeFileSync(join(DEST, "certs.json"), `${JSON.stringify(certs, null, 2)}\n`);
console.log(`Copied ${certs.length} cert dataset(s) to ${DEST}.`);
