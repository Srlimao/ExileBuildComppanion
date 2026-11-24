import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const NEVERSINK_VERSION = "0.10.4a";
const LEAGUE_NAME = "PoE 2 Early Access";
const RELEASE_TITLE = "NeverSink's PoE2 Filter - version 0.10.4a - Clean up and preparations";
const SOURCE_REPO = "https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2";
const RAW_BASE = "https://raw.githubusercontent.com/NeverSinkDev/NeverSink-Filter-for-PoE2";

const PRESETS = [
  {
    id: "regular",
    strictnessCode: "1-REGULAR",
    upstreamFile: "NeverSink's filter 2 - 1-REGULAR.filter",
    targetFileName: "ExileHUD_PoE2_LeagueStart_Regular.filter",
  },
  {
    id: "semi_strict",
    strictnessCode: "2-SEMI-STRICT",
    upstreamFile: "NeverSink's filter 2 - 2-SEMI-STRICT.filter",
    targetFileName: "ExileHUD_PoE2_LeagueStart_SemiStrict.filter",
  },
];

async function loadOrFetchCachedText(cachePath, remoteUrl) {
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, "utf8");
  }
  const response = await fetch(remoteUrl, {
    headers: { "User-Agent": "exile-companion-hud-ingestor" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${remoteUrl}: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return text;
}

async function loadOrFetchUpstreamText(rootDir, version, fileName) {
  const cachePath = path.join(rootDir, ".upstream-cache", "neversink-filter-poe2", version, fileName);
  const remoteUrl = `${RAW_BASE}/${version}/${encodeURIComponent(fileName)}`;
  return loadOrFetchCachedText(cachePath, remoteUrl);
}

async function loadOrFetchLicense(rootDir, version) {
  const cachePath = path.join(rootDir, ".upstream-cache", "neversink-filter-poe2", "LICENSE");
  const remoteUrl = `${RAW_BASE}/${version}/LICENSE`;
  return (await loadOrFetchCachedText(cachePath, remoteUrl)).trim();
}

function buildFilterBanner(strictnessCode) {
  return [
    "#===============================================================================================================",
    `# Exile Companion HUD — Baked PoE 2 Base Filter (${LEAGUE_NAME} | NeverSink PoE2 v${NEVERSINK_VERSION} | Preset: ${strictnessCode})`,
    "#===============================================================================================================",
  ].join("\n");
}

/** Downloads/caches NeverSink PoE 2 starter filters and emits baked assets + metadata JSON. */
export async function ingestNeversinkPoe2LootFilter(rootDir = process.cwd()) {
  const dataDir = path.join(rootDir, "packages", "game-data", "data", "poe2");
  const filtersOutDir = path.join(dataDir, "filters");
  fs.mkdirSync(filtersOutDir, { recursive: true });

  const licenseText = await loadOrFetchLicense(rootDir, NEVERSINK_VERSION);
  const presetMetas = [];

  for (const preset of PRESETS) {
    const rawText = await loadOrFetchUpstreamText(rootDir, NEVERSINK_VERSION, preset.upstreamFile);
    const normalizedBody = rawText.replace(/\r\n/g, "\n");
    const bakedContent = `${buildFilterBanner(preset.strictnessCode)}\n${normalizedBody}`;
    const targetPath = path.join(filtersOutDir, preset.targetFileName);
    fs.writeFileSync(targetPath, bakedContent, "utf8");

    presetMetas.push({
      id: preset.id,
      strictnessCode: preset.strictnessCode,
      targetFileName: preset.targetFileName,
      lineCount: bakedContent.split("\n").length,
      byteSize: Buffer.byteLength(bakedContent, "utf8"),
    });
  }

  const metadata = {
    version: NEVERSINK_VERSION,
    leagueName: LEAGUE_NAME,
    releaseTitle: RELEASE_TITLE,
    sourceRepo: SOURCE_REPO,
    defaultPresetId: "regular",
    presets: presetMetas,
  };

  fs.writeFileSync(
    path.join(dataDir, "league_starter_filter_meta.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  return {
    version: NEVERSINK_VERSION,
    leagueName: LEAGUE_NAME,
    presets: presetMetas,
    licenseText,
  };
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestNeversinkPoe2LootFilter()
    .then((res) => {
      const summary = res.presets.map((p) => `${p.strictnessCode} (${p.lineCount} lines)`).join(", ");
      console.log(
        `Ingested NeverSink PoE2 ${res.version} (${res.leagueName}) loot filters: ${summary}.`,
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
