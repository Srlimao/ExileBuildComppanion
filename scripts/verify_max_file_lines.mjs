import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SCAN_DIRS = ["packages", "apps", "scripts"];
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "target",
  ".wrangler",
  ".upstream-cache",
  ".git",
  "gen",
]);
const CHECKED_EXTENSIONS = new Set([".ts", ".tsx", ".rs", ".mjs", ".css"]);
const MAX_LINES_EXCLUSIVE = 300;

/**
 * Recursively collects source files under a directory while skipping build artifacts.
 */
function collectSourceFiles(dirPath, collected) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, collected);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".d.ts")) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (CHECKED_EXTENSIONS.has(ext)) {
        collected.push(fullPath);
      }
    }
  }
}

function countFileLines(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (raw.length === 0) return 0;
  return raw.split(/\r?\n/).length;
}

function main() {
  const files = [];
  for (const relDir of SCAN_DIRS) {
    collectSourceFiles(path.join(ROOT_DIR, relDir), files);
  }

  const results = files.map((filePath) => ({
    relPath: path.relative(ROOT_DIR, filePath).replace(/\\/g, "/"),
    lines: countFileLines(filePath),
  }));

  results.sort((a, b) => b.lines - a.lines);

  const violations = results.filter((r) => r.lines >= MAX_LINES_EXCLUSIVE);
  console.log(`Checked ${results.length} source files (limit < ${MAX_LINES_EXCLUSIVE} lines).`);
  console.log("Top 5 longest files:");
  for (const item of results.slice(0, 5)) {
    const marker = item.lines >= MAX_LINES_EXCLUSIVE ? "FAIL" : "OK";
    console.log(`  [${marker}] ${item.lines.toString().padStart(3, " ")} lines — ${item.relPath}`);
  }

  if (violations.length > 0) {
    console.error("\nLine-limit violations detected:");
    for (const v of violations) {
      console.error(`  - ${v.relPath} (${v.lines} lines >= ${MAX_LINES_EXCLUSIVE})`);
    }
    process.exit(1);
  }
}

main();
