import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

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

const ANGLES_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANGLES_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190,
  200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
];

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

function computeNodeCoords(tree, node) {
  const group = tree.groups[node.group];
  if (!group) return { x: 0, y: 0 };
  const orbit = Number(node.orbit || 0);
  const orbitIndex = Number(node.orbitindex || 0);
  const radius = Number(tree.constants.orbitradii[orbit] || 0);
  const skillsPerOrbit = Number(tree.constants.skillsperorbit[orbit] || 1);
  let angleDeg;
  if (skillsPerOrbit === 16) angleDeg = ANGLES_16[orbitIndex] ?? 0;
  else if (skillsPerOrbit === 40) angleDeg = ANGLES_40[orbitIndex] ?? 0;
  else angleDeg = (360 / skillsPerOrbit) * orbitIndex;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round(Number(group.x) + radius * Math.sin(rad)),
    y: Math.round(Number(group.y) - radius * Math.cos(rad)),
  };
}

function extractPassiveTreeNodes() {
  const rawPath = path.join(CACHE_EXILE_UI, "data", "global", "[leveltracker] tree 3_29.json");
  const rawTree = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  const compactNodes = {};
  for (const [id, node] of Object.entries(rawTree.nodes)) {
    if (node.classstartindex !== undefined) continue;
    const { x, y } = computeNodeCoords(rawTree, node);
    compactNodes[id] = {
      id,
      name: node.name || `Node ${id}`,
      isNotable: node.isnotable === "1",
      isKeystone: node.iskeystone === "1",
      isMastery: node.ismastery === "1",
      stats: Array.isArray(node.stats) ? node.stats : [],
      x,
      y,
    };
  }
  fs.writeFileSync(path.join(GAME_DATA_DIR, "passive_tree_nodes.json"), JSON.stringify(compactNodes));
  return Object.keys(compactNodes).length;
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

function writeThirdPartyLicenses() {
  const exileLevelingLic = fs.readFileSync(path.join(CACHE_EXILE_LEVELING, "LICENSE"), "utf8").trim();
  const exileUiLic = readExileUiLicense();
  const content = `# Third-Party Open Source Licenses

This repository incorporates MIT-licensed game datasets, route syntax, icons, and zone layout diagrams from the following projects:

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
`;
  fs.writeFileSync(path.join(ROOT, "THIRD_PARTY_LICENSES.md"), content);
}

async function main() {
  ensureUpstreamExists();
  copyExileLevelingData();
  const nodeCount = extractPassiveTreeNodes();
  const layoutCount = await convertZoneLayoutsToWebp();
  writeThirdPartyLicenses();
  console.log(`Ingested PoE1 assets: ${nodeCount} passive tree nodes, ${layoutCount} WebP zone layouts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
