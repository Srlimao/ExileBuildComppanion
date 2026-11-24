import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POE2_TREE_VERSION = "0_5";
const POE2_TREE_URL = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/TreeData/${POE2_TREE_VERSION}/tree.json`;

function cleanStatText(text) {
  return String(text ?? "")
    .replace(/\[[^\]|]+\|([^\]]+)\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveRawGroup(rawTree, groupId) {
  if (Array.isArray(rawTree.groups)) {
    return rawTree.groups[Number(groupId) - 1] ?? null;
  }
  return rawTree.groups?.[String(groupId)] ?? null;
}

function computePoe2NodeCoords(rawTree, node) {
  const group = resolveRawGroup(rawTree, node.group);
  if (!group) return { x: 0, y: 0 };
  const orbit = Number(node.orbit ?? 0);
  const orbitIndex = Number(node.orbitIndex ?? 0);
  const radius = Number(rawTree.constants?.orbitRadii?.[orbit] ?? 0);
  const skillsPerOrbit = Number(rawTree.constants?.skillsPerOrbit?.[orbit] ?? 1);
  const radTable = rawTree.constants?.orbitAnglesByOrbit?.[orbit];
  const angleRad =
    Array.isArray(radTable) && typeof radTable[orbitIndex] === "number"
      ? Number(radTable[orbitIndex])
      : ((Math.PI * 2) / Math.max(1, skillsPerOrbit)) * orbitIndex;

  return {
    x: Math.round(Number(group.x) + radius * Math.sin(angleRad)),
    y: Math.round(Number(group.y) - radius * Math.cos(angleRad)),
  };
}

async function loadOrFetchPoe2RawTree(rootDir) {
  const cacheDir = path.join(rootDir, ".upstream-cache", "pob2-tree");
  const cachePath = path.join(cacheDir, `tree-${POE2_TREE_VERSION}.json`);
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }
  const response = await fetch(POE2_TREE_URL, {
    headers: { "User-Agent": "exile-companion-hud-ingestor" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch PoB2 tree ${POE2_TREE_VERSION}: HTTP ${response.status}`);
  }
  const text = await response.text();
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, text, "utf8");
  return JSON.parse(text);
}

/** Downloads/parses PathOfBuilding-PoE2 tree.json into compact PoE 2 JSON datasets. */
export async function ingestPoe2PassiveTree(rootDir = process.cwd()) {
  const rawTree = await loadOrFetchPoe2RawTree(rootDir);
  const outDir = path.join(rootDir, "packages", "game-data", "data", "poe2");
  fs.mkdirSync(outDir, { recursive: true });

  const classesList = Array.isArray(rawTree.classes) ? rawTree.classes : [];
  const classIdxByLowerName = new Map(
    classesList.map((cls, idx) => [String(cls.name ?? "").trim().toLowerCase(), idx]),
  );

  const keptById = new Map();
  for (const [key, rawNode] of Object.entries(rawTree.nodes ?? {})) {
    if (key === "root" || !rawNode || rawNode.isProxy || rawNode.isOnlyImage) continue;
    if (typeof rawNode.group !== "number") continue;
    const id = String(rawNode.skill ?? key);
    keptById.set(id, rawNode);
  }

  const undirectedEdges = new Map();
  const addEdge = (a, b) => {
    if (a === b) return;
    let setA = undirectedEdges.get(a);
    if (!setA) {
      setA = new Set();
      undirectedEdges.set(a, setA);
    }
    setA.add(b);
  };

  for (const [id, rawNode] of keptById.entries()) {
    for (const conn of rawNode.connections ?? []) {
      const targetId = String(typeof conn === "object" && conn !== null ? conn.id : conn);
      const target = keptById.get(targetId);
      if (!target) continue;
      if (Boolean(rawNode.ascendancyName) !== Boolean(target.ascendancyName)) continue;
      addEdge(id, targetId);
      addEdge(targetId, id);
    }
  }

  const compactNodes = {};
  const referencedGroupIds = new Set();
  const classStartNodeIds = new Map();

  for (const [id, rawNode] of keptById.entries()) {
    const { x, y } = computePoe2NodeCoords(rawTree, rawNode);
    const startNames = Array.isArray(rawNode.classesStart) ? rawNode.classesStart : [];
    const matchedClassIndices = startNames
      .map((name) => classIdxByLowerName.get(String(name).trim().toLowerCase()))
      .filter((idx) => typeof idx === "number");

    for (const idx of matchedClassIndices) {
      classStartNodeIds.set(idx, id);
    }

    const hasClassStart =
      typeof rawNode.classStartIndex === "number" || matchedClassIndices.length > 0;
    const classStartIdx =
      typeof rawNode.classStartIndex === "number" ? rawNode.classStartIndex : matchedClassIndices[0];
    const friendlyName = hasClassStart
      ? `${startNames.join(" / ") || classesList[classStartIdx]?.name || "Class"} Start`
      : String(rawNode.name ?? `Node ${id}`);

    const outList = [...(undirectedEdges.get(id) ?? [])];
    const entry = {
      id,
      name: friendlyName,
      isNotable: Boolean(rawNode.isNotable),
      isKeystone: Boolean(rawNode.isKeystone),
      isMastery: false,
      stats: Array.isArray(rawNode.stats) ? rawNode.stats.map(cleanStatText).filter(Boolean) : [],
      x,
      y,
    };

    if (rawNode.stringId) entry.stringId = String(rawNode.stringId);
    if (rawNode.isJewelSocket) entry.isJewelSocket = true;
    if (rawNode.isAscendancyStart) entry.isAscendancyStart = true;
    if (rawNode.ascendancyName) entry.ascendancyName = String(rawNode.ascendancyName);
    if (typeof classStartIdx === "number") entry.classStartIndex = classStartIdx;
    entry.group = rawNode.group;
    referencedGroupIds.add(String(rawNode.group));
    if (typeof rawNode.orbit === "number") entry.orbit = rawNode.orbit;
    if (typeof rawNode.orbitIndex === "number") entry.orbitIndex = rawNode.orbitIndex;
    if (outList.length > 0) entry.out = outList;

    compactNodes[id] = entry;
  }

  let actualMinX = Infinity;
  let actualMinY = Infinity;
  let actualMaxX = -Infinity;
  let actualMaxY = -Infinity;
  for (const node of Object.values(compactNodes)) {
    if (node.x < actualMinX) actualMinX = node.x;
    if (node.y < actualMinY) actualMinY = node.y;
    if (node.x > actualMaxX) actualMaxX = node.x;
    if (node.y > actualMaxY) actualMaxY = node.y;
  }

  const groups = {};
  for (const gid of referencedGroupIds) {
    const g = resolveRawGroup(rawTree, gid);
    if (!g) continue;
    groups[gid] = {
      x: Math.round(Number(g.x)),
      y: Math.round(Number(g.y)),
      orbits: Array.isArray(g.orbits) ? g.orbits.map(Number) : [],
    };
  }

  const graphMeta = {
    version: `poe2-${POE2_TREE_VERSION}`,
    minX: Math.round(Number(rawTree.min_x ?? (actualMinX !== Infinity ? actualMinX : -25000))),
    minY: Math.round(Number(rawTree.min_y ?? (actualMinY !== Infinity ? actualMinY : -25000))),
    maxX: Math.round(Number(rawTree.max_x ?? (actualMaxX !== -Infinity ? actualMaxX : 25000))),
    maxY: Math.round(Number(rawTree.max_y ?? (actualMaxY !== -Infinity ? actualMaxY : 25000))),
    orbitRadii: (rawTree.constants?.orbitRadii ?? [0, 82, 162, 335, 493, 662, 846, 251, 1080, 1322]).map(Number),
    skillsPerOrbit: (rawTree.constants?.skillsPerOrbit ?? [1, 12, 24, 24, 72, 72, 72, 24, 72, 144]).map(Number),
    classes: classesList.map((cls, idx) => ({
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
  return {
    version: graphMeta.version,
    nodeCount: Object.keys(compactNodes).length,
    groupCount: Object.keys(groups).length,
    classesWithStart: graphMeta.classes.filter((c) => Boolean(c.startNodeId)).length,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isCli) {
  ingestPoe2PassiveTree()
    .then((res) =>
      console.log(
        `Ingested PoE 2 ${res.version} passive tree: ${res.nodeCount} nodes across ${res.groupCount} groups (${res.classesWithStart} class starts).`,
      ),
    )
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
