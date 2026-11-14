import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(THIS_DIR, "..");
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function updateJsonVersion(filePath, semver) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lineEnding = raw.includes("\r\n") ? "\r\n" : "\n";
  const parsed = JSON.parse(raw);
  parsed.version = semver;
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
  fs.writeFileSync(
    filePath,
    lineEnding === "\r\n" ? serialized.replace(/\n/g, "\r\n") : serialized,
    "utf8",
  );
}

function updateCargoPackageVersion(filePath, semver) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lineEnding = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  let inPackageSection = false;
  let replaced = false;

  const updated = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inPackageSection = trimmed === "[package]";
      return line;
    }
    if (inPackageSection && !replaced && /^version\s*=\s*"[^"]*"/.test(trimmed)) {
      replaced = true;
      return `version = "${semver}"`;
    }
    return line;
  });

  if (!replaced) {
    throw new Error(`Could not locate [package] version in ${filePath}`);
  }
  fs.writeFileSync(filePath, updated.join(lineEnding), "utf8");
}

function main() {
  const rawArg = process.argv[2]?.trim() ?? "";
  const semver = rawArg.replace(/^[vV]/, "");
  if (!SEMVER_REGEX.test(semver)) {
    console.error(`Invalid semver argument: "${rawArg}"`);
    process.exit(1);
  }

  updateJsonVersion(path.join(ROOT_DIR, "apps/desktop/package.json"), semver);
  updateJsonVersion(path.join(ROOT_DIR, "apps/desktop/src-tauri/tauri.conf.json"), semver);
  updateCargoPackageVersion(path.join(ROOT_DIR, "apps/desktop/src-tauri/Cargo.toml"), semver);

  console.log(`Stamped desktop version ${semver}`);
}

main();
