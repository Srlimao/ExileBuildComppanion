import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ingestGggPassiveTree } from "./ingest_ggg_passive_tree.mjs";
import { ingestNeversinkLootFilter } from "./ingest_neversink_loot_filter.mjs";
import { ingestRepoeCraftingBench } from "./ingest_repoe_crafting_bench.mjs";
import { ingestTwinkGearAssets } from "./ingest_twink_gear_assets.mjs";

const ROOT = process.cwd();
const CACHE_EXILE_LEVELING = path.join(ROOT, ".upstream-cache", "exile-leveling");
const CACHE_EXILE_UI = path.join(ROOT, ".upstream-cache", "exile-ui");
const CACHE_EXILE_UI_ZONES = path.join(
  ROOT,
  ".upstream-cache",
  "exile-ui-git",
  "img",
  "GUI",
  "act-decoder",
  "zones",
);
const GAME_DATA_DIR = path.join(ROOT, "packages", "game-data", "data", "poe1");
const PWA_ASSETS_DIR = path.join(ROOT, "apps", "pwa", "public", "assets", "poe1");

function ensureUpstreamExists() {
  if (!fs.existsSync(CACHE_EXILE_LEVELING) || !fs.existsSync(CACHE_EXILE_UI_ZONES)) {
    throw new Error(
      "Missing .upstream-cache directories. Download HeartofPhos/exile-leveling and sparse-clone Lailloken/Exile-UI into .upstream-cache/ first.",
    );
  }
}

function copyExileLevelingData() {
  fs.mkdirSync(GAME_DATA_DIR, { recursive: true });
  const jsonFiles = [
    "areas.json",
    "gems.json",
    "quests.json",
    "characters.json",
    "gem-colours.json",
    "kill-waypoints.json",
    "awakened-gem-lookup.json",
    "vaal-gem-lookup.json",
  ];
  for (const file of jsonFiles) {
    fs.copyFileSync(
      path.join(CACHE_EXILE_LEVELING, "common", "data", "json", file),
      path.join(GAME_DATA_DIR, file),
    );
  }

  const routes = {};
  for (let act = 1; act <= 10; act++) {
    const key = `act-${act}`;
    routes[key] = fs.readFileSync(
      path.join(CACHE_EXILE_LEVELING, "common", "data", "routes", `${key}.txt`),
      "utf8",
    );
  }
  fs.writeFileSync(path.join(GAME_DATA_DIR, "default_routes.json"), JSON.stringify(routes));

  const iconsOut = path.join(PWA_ASSETS_DIR, "icons");
  fs.mkdirSync(iconsOut, { recursive: true });
  const iconSources = [
    path.join(CACHE_EXILE_LEVELING, "web", "src", "components", "GemCost", "images"),
    path.join(CACHE_EXILE_LEVELING, "web", "src", "components", "FragmentStep", "Fragment", "images"),
  ];
  for (const dir of iconSources) {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith(".png")) {
        fs.copyFileSync(path.join(dir, entry), path.join(iconsOut, entry));
      }
    }
  }
}

async function convertZoneLayoutsToWebp() {
  const outDir = path.join(PWA_ASSETS_DIR, "zone-layouts");
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(CACHE_EXILE_UI_ZONES).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const manifest = {};

  for (const filename of files) {
    const base = path.parse(filename).name;
    const spaceIdx = base.indexOf(" ");
    const areaId = spaceIdx === -1 ? base : base.slice(0, spaceIdx);
    const variant = spaceIdx === -1 ? "1" : base.slice(spaceIdx + 1).replace(/\s+/g, "_");
    const webpName = `${areaId}__${variant}.webp`;
    await sharp(path.join(CACHE_EXILE_UI_ZONES, filename))
      .webp({ quality: 76 })
      .toFile(path.join(outDir, webpName));
    if (!manifest[areaId]) manifest[areaId] = [];
    manifest[areaId].push(`/assets/poe1/zone-layouts/${webpName}`);
  }

  for (const key of Object.keys(manifest)) {
    manifest[key].sort();
  }
  fs.writeFileSync(path.join(GAME_DATA_DIR, "zone_layout_manifest.json"), JSON.stringify(manifest, null, 2));
  return files.length;
}

function readExileUiLicense() {
  const candidates = [
    path.join(CACHE_EXILE_UI, "LICENSE.md"),
    path.join(ROOT, ".upstream-cache", "exile-ui-git", "LICENSE.md"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf8").trim();
  }
  return execFileSync("git", ["-C", path.join(ROOT, ".upstream-cache", "exile-ui-git"), "show", "HEAD:LICENSE.md"], {
    encoding: "utf8",
  }).trim();
}

function writeThirdPartyLicenses(neversinkInfo) {
  const exileLevelingLic = fs.readFileSync(path.join(CACHE_EXILE_LEVELING, "LICENSE"), "utf8").trim();
  const exileUiLic = readExileUiLicense();
  const content = `# Third-Party Open Source Licenses

This repository incorporates MIT-licensed game datasets, route syntax, icons, loot filters, and zone layout diagrams from the following projects:

## HeartofPhos/exile-leveling
Source: https://github.com/HeartofPhos/exile-leveling

\`\`\`
${exileLevelingLic}
\`\`\`

## Lailloken/Exile-UI
Source: https://github.com/Lailloken/Exile-UI

\`\`\`
${exileUiLic}
\`\`\`

## NeverSinkDev/NeverSink-Filter
Source: https://github.com/NeverSinkDev/NeverSink-Filter (Tag \`${neversinkInfo.version}\`)

\`\`\`
${neversinkInfo.licenseText}
\`\`\`

## grindinggear/skilltree-export
Source: https://github.com/grindinggear/skilltree-export (Tag \`3.30.0\`)

Official Path of Exile Passive Skill Tree export JSON (\`data.json\`) provided publicly by Grinding Gear Games for community build planners and tools.

## brather1ng/RePoE
Source: https://github.com/brather1ng/RePoE

Community-maintained JSON extractions of Path of Exile game data (\`crafting_bench_options.min.json\`, \`mods.min.json\`) used for campaign bench craft recipe suggestions.

## repoe-fork/repoe-fork.github.io & Official PoE 2D Item Art
Source: https://repoe-fork.github.io/uniques.min.json

Community-maintained Path of Exile unique item visual identity mapping (\`uniques.min.json\`) pointing to official 2D item artwork hosted on \`web.poecdn.com\`, used for twink leveling gear thumbnails.
`;
  fs.writeFileSync(path.join(ROOT, "THIRD_PARTY_LICENSES.md"), content);
}

async function main() {
  ensureUpstreamExists();
  copyExileLevelingData();
  const { nodeCount } = await ingestGggPassiveTree(ROOT);
  const { recipeCount } = await ingestRepoeCraftingBench(ROOT);
  const { catalogCount } = await ingestTwinkGearAssets(ROOT);
  const neversinkInfo = await ingestNeversinkLootFilter(ROOT);
  const layoutCount = await convertZoneLayoutsToWebp();
  writeThirdPartyLicenses(neversinkInfo);
  console.log(
    `Ingested PoE1 assets: ${nodeCount} passive tree nodes, ${recipeCount} bench recipes, ${catalogCount} twink gear icons, ${neversinkInfo.presets.length} NeverSink ${neversinkInfo.version} loot filters, ${layoutCount} WebP zone layouts.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
