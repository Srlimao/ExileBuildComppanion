import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILLTREE_VERSION = "3.30.0";
const SKILLTREE_URL = `https://raw.githubusercontent.com/grindinggear/skilltree-export/${SKILLTREE_VERSION}/data.json`;

const ANGLES_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANGLES_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190,
  200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350,
];

function cleanGggStatText(text) {
  return String(text ?? "")
    .replace(/\[[^\]|]+\|([^\]]+)\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function computeNodeCoords(rawTree, node) {
  const group = rawTree.groups?.[String(node.group)];
  if (!group) return { x: 0, y: 0 };
  const orbit = Number(node.orbit ?? 0);
  const orbitIndex = Number(node.orbitIndex ?? 0);
  const radius = Number(rawTree.constants?.orbitRadii?.[orbit] ?? 0);
  const skillsPerOrbit = Number(rawTree.constants?.skillsPerOrbit?.[orbit] ?? 1);
  let angleDeg;
  if (skillsPerOrbit === 16) angleDeg = ANGLES_16[orbitIndex] ?? 0;
  else if (skillsPerOrbit === 40) angleDeg = ANGLES_40[orbitIndex] ?? 0;
  else angleDeg = (360 / Math.max(1, skillsPerOrbit)) * orbitIndex;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round(Number(group.x) + radius * Math.sin(rad)),
    y: Math.round(Number(group.y) - radius * Math.cos(rad)),
  };
}

async function loadOrFetchRawTree(rootDir) {
  const cacheDir = path.join(rootDir, ".upstream-cache", "ggg-skilltree-export");
  const cachePath = path.join(cacheDir, `data-${SKILLTREE_VERSION}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const response = await fetch(SKILLTREE_URL, {
    headers: { "User-Agent": "exile-companion-hud-ingestor" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch GGG skilltree-export ${SKILLTREE_VERSION}: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text);
}

/** Downloads/parses official GGG skilltree-export data.json into compact PoE1 JSON datasets. */
export async function ingestGggPassiveTree(rootDir = process.cwd()) {
  const rawTree = await loadOrFetchRawTree(rootDir);
  const outDir = path.join(rootDir, "packages", "game-data", "data", "poe1");
  fs.mkdirSync(outDir, { recursive: true });

  const classNamesByIdx = (rawTree.classes ?? []).map((cls) => String(cls.name ?? "Class"));
  const rawNodesEntries = Object.entries(rawTree.nodes ?? {}).filter(([key, n]) => {
    if (key === "root" || !n) return false;
    if (n.isProxy || n.isBloodline) return false;
    return true;
  });

  const keptById = new Map();
  const classStartNodeIds = new Map();
  for (const [key, rawNode] of rawNodesEntries) {
    const id = String(rawNode.skill ?? key);
    keptById.set(id, rawNode);
    if (typeof rawNode.classStartIndex === "number") {
      classStartNodeIds.set(rawNode.classStartIndex, id);
    }
  }

  const compactNodes = {};
  const referencedGroupIds = new Set();

  for (const [id, rawNode] of keptById.entries()) {
    const { x, y } = computeNodeCoords(rawTree, rawNode);
    const hasClassStart = typeof rawNode.classStartIndex === "number";
    const friendlyName = hasClassStart
      ? `${classNamesByIdx[rawNode.classStartIndex] ?? "Class"} Start`
      : String(rawNode.name ?? `Node ${id}`);

    const filteredOut = rawNode.isMastery || rawNode.isBlighted
      ? []
      : (rawNode.out ?? []).map(String).filter((targetId) => {
          const target = keptById.get(targetId);
          if (!target || target.isMastery || target.isBlighted) return false;
          return Boolean(rawNode.ascendancyName) === Boolean(target.ascendancyName);
        });

    const entry = {
      id,
      name: friendlyName,
      isNotable: Boolean(rawNode.isNotable),
      isKeystone: Boolean(rawNode.isKeystone),
      isMastery: Boolean(rawNode.isMastery),
      stats: Array.isArray(rawNode.stats) ? rawNode.stats.map(cleanGggStatText).filter(Boolean) : [],
      x,
      y,
    };

    if (rawNode.isJewelSocket) entry.isJewelSocket = true;
    if (rawNode.isAscendancyStart) entry.isAscendancyStart = true;
    if (rawNode.isBlighted) entry.isBlighted = true;
    if (rawNode.ascendancyName) entry.ascendancyName = String(rawNode.ascendancyName);
    if (hasClassStart) entry.classStartIndex = rawNode.classStartIndex;
    if (typeof rawNode.group === "number") {
      entry.group = rawNode.group;
      referencedGroupIds.add(String(rawNode.group));
    }
    if (typeof rawNode.orbit === "number") entry.orbit = rawNode.orbit;
    if (typeof rawNode.orbitIndex === "number") entry.orbitIndex = rawNode.orbitIndex;
    if (filteredOut.length > 0) entry.out = filteredOut;
    if (Array.isArray(rawNode.masteryEffects) && rawNode.masteryEffects.length > 0) {
      entry.masteryEffects = rawNode.masteryEffects.map((eff) => ({
        effectId: String(eff.effect),
        stats: Array.isArray(eff.stats) ? eff.stats.map(cleanGggStatText).filter(Boolean) : [],
      }));
    }

    compactNodes[id] = entry;
  }

  const groups = {};
  for (const gid of referencedGroupIds) {
    const g = rawTree.groups?.[gid];
    if (!g) continue;
    groups[gid] = {
      x: Math.round(Number(g.x)),
      y: Math.round(Number(g.y)),
      orbits: Array.isArray(g.orbits) ? g.orbits.map(Number) : [],
    };
  }

  const graphMeta = {
    version: SKILLTREE_VERSION,
    minX: Number(rawTree.min_x ?? -13000),
    minY: Number(rawTree.min_y ?? -11500),
    maxX: Number(rawTree.max_x ?? 13000),
    maxY: Number(rawTree.max_y ?? 11500),
    orbitRadii: (rawTree.constants?.orbitRadii ?? [0, 82, 162, 335, 493, 662, 846]).map(Number),
    skillsPerOrbit: (rawTree.constants?.skillsPerOrbit ?? [1, 6, 16, 16, 40, 72, 72]).map(Number),
    classes: (rawTree.classes ?? []).map((cls, idx) => ({
      classIndex: idx,
      name: String(cls.name ?? `Class ${idx}`),
      startNodeId: classStartNodeIds.get(idx) ?? "",
      ascendancies: Array.isArray(cls.ascendancies)
        ? cls.ascendancies.map((a) => String(typeof a === "string" ? a : a.name ?? ""))
        : [],
    })),
    groups,
  };

  fs.writeFileSync(path.join(outDir, "passive_tree_nodes.json"), JSON.stringify(compactNodes));
  fs.writeFileSync(path.join(outDir, "passive_tree_graph_meta.json"), JSON.stringify(graphMeta));
  return { version: SKILLTREE_VERSION, nodeCount: Object.keys(compactNodes).length, groupCount: Object.keys(groups).length };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestGggPassiveTree()
    .then((res) => console.log(`Ingested GGG ${res.version} passive tree: ${res.nodeCount} nodes across ${res.groupCount} groups.`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
