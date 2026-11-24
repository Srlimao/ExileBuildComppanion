import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOE_POE2_UNIQUES_URL = "https://repoe-fork.github.io/poe2/uniques.min.json";
const USER_AGENT = "exile-companion-hud-ingestor";

async function loadOrFetchPoe2Uniques(rootDir) {
  const cacheDir = path.join(rootDir, ".upstream-cache", "repoe");
  const cachePath = path.join(cacheDir, "poe2_uniques.min.json");
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const response = await fetch(REPOE_POE2_UNIQUES_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repoe-fork poe2 uniques.min.json: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text);
}

function buildPoe2UniqueIconMap(uniques) {
  const iconMap = {};
  for (const entry of Object.values(uniques)) {
    if (!entry || entry.is_alternate_art) continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const dds = entry.visual_identity?.dds_file;
    if (!name || typeof dds !== "string" || !dds) continue;
    const key = name.toLowerCase();
    if (iconMap[key]) continue;
    const webpRel = dds.replace(/^Art\/2DItems\//i, "").replace(/\.dds$/i, ".webp");
    iconMap[key] = webpRel;
  }
  return iconMap;
}

/** Ingests official PoE 2 unique 2D art relative paths from RePoE PoE 2 uniques metadata. */
export async function ingestPoe2UniqueIcons(rootDir = process.cwd()) {
  const uniques = await loadOrFetchPoe2Uniques(rootDir);
  const iconMap = buildPoe2UniqueIconMap(uniques);
  const outDir = path.join(rootDir, "packages", "game-data", "data", "poe2");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "unique_item_icons.json");
  fs.writeFileSync(outPath, JSON.stringify(iconMap));
  return {
    outPath,
    iconMapCount: Object.keys(iconMap).length,
    hasEnfoldingDawn: Boolean(iconMap["enfolding dawn"]),
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestPoe2UniqueIcons()
    .then((res) => {
      console.log(`Ingested ${res.iconMapCount} PoE 2 unique icons (enfolding dawn=${res.hasEnfoldingDawn}).`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
