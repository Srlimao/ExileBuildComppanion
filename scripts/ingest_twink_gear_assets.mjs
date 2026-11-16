import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const REPOE_FORK_UNIQUES_URL = "https://repoe-fork.github.io/uniques.min.json";
const POE_CDN_2DITEMS_BASE = "https://web.poecdn.com/image/Art/2DItems/";
const USER_AGENT = "exile-companion-hud-ingestor";

async function loadOrFetchUniquesJson(rootDir) {
  const cacheDir = path.join(rootDir, ".upstream-cache", "repoe");
  const cachePath = path.join(cacheDir, "uniques.min.json");
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const response = await fetch(REPOE_FORK_UNIQUES_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repoe-fork uniques.min.json: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text);
}

function buildUniqueIconMap(uniques) {
  const iconMap = {};
  for (const entry of Object.values(uniques)) {
    if (!entry || entry.is_alternate_art) continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const dds = entry.visual_identity?.dds_file;
    if (!name || typeof dds !== "string" || !dds) continue;
    const key = name.toLowerCase();
    if (iconMap[key]) continue;
    const pngRel = dds.replace(/^Art\/2DItems\//i, "").replace(/\.dds$/i, ".png");
    const w = Number(entry.inventory_width) || 1;
    const h = Number(entry.inventory_height) || 1;
    iconMap[key] = `${pngRel}?scale=1&w=${w}&h=${h}`;
  }
  return iconMap;
}

async function ensureItemWebpAsset(rootDir, item, iconSuffix, outDir) {
  const pngCacheDir = path.join(rootDir, ".upstream-cache", "twink-icons");
  fs.mkdirSync(pngCacheDir, { recursive: true });
  const rawPngPath = path.join(pngCacheDir, `${item.id}.png`);
  let pngBuffer;

  if (fs.existsSync(rawPngPath)) {
    pngBuffer = fs.readFileSync(rawPngPath);
  } else {
    const url = `${POE_CDN_2DITEMS_BASE}${iconSuffix}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      throw new Error(`Failed to download official art for "${item.itemName}" (${url}): HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("image/")) {
      throw new Error(`Unexpected content-type "${contentType}" for "${item.itemName}" at ${url}`);
    }
    pngBuffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(rawPngPath, pngBuffer);
  }

  const webpPath = path.join(outDir, `${item.id}.webp`);
  await sharp(pngBuffer).webp({ quality: 86, alphaQuality: 100 }).toFile(webpPath);
}

/** Ingests official PoE1 unique 2D art mappings and local WebP thumbnails for curated twink items. */
export async function ingestTwinkGearAssets(rootDir = process.cwd()) {
  const gameDataDir = path.join(rootDir, "packages", "game-data", "data", "poe1");
  const catalogPath = path.join(gameDataDir, "twink_gear_catalog.json");
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Missing curated twink catalog JSON at ${catalogPath}`);
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const uniques = await loadOrFetchUniquesJson(rootDir);
  const iconMap = buildUniqueIconMap(uniques);

  fs.mkdirSync(gameDataDir, { recursive: true });
  fs.writeFileSync(path.join(gameDataDir, "unique_item_icons.json"), JSON.stringify(iconMap));

  const webpOutDir = path.join(rootDir, "apps", "pwa", "public", "assets", "poe1", "twink-items");
  fs.mkdirSync(webpOutDir, { recursive: true });

  for (const item of catalog) {
    const suffix = iconMap[item.itemName.trim().toLowerCase()];
    if (!suffix) {
      throw new Error(`Curated twink item "${item.itemName}" not found in repoe-fork uniques.min.json`);
    }
    await ensureItemWebpAsset(rootDir, item, suffix, webpOutDir);
  }

  return {
    catalogCount: catalog.length,
    iconMapCount: Object.keys(iconMap).length,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestTwinkGearAssets()
    .then((res) =>
      console.log(
        `Ingested ${res.catalogCount} twink gear WebP icons and ${res.iconMapCount} unique item icon mappings.`,
      ),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
