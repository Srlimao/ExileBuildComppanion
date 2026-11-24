import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "packages", "game-data", "data", "poe2");

const REPOE_POE2_AREAS_URL = "https://repoe-fork.github.io/poe2/world_areas.min.json";
const POB2_RAW_BASE = "https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev";
const POB2_SKILL_FILES = ["act_str.lua", "act_dex.lua", "act_int.lua", "minion.lua", "other.lua"];

const SKILL_TIER_LEVEL_REQ = [1, 3, 6, 10, 14, 18, 22, 26, 31, 36, 41, 46, 52, 58, 64];
const SUPPORT_TIER_LEVEL_REQ = [1, 16, 31, 46, 58];

const TOWN_BY_STAGE = {
  1: "G1_town",
  2: "G2_town",
  3: "G3_town",
  4: "G4_town",
  5: "P1_Town",
  6: "P2_Town",
  7: "P3_Town",
  8: "G_Endgame_Town",
};

function resolveStageAct(id) {
  if (/^G1_/.test(id)) return 1;
  if (/^G2_/.test(id) || /^Sanctum_[1-4]$/.test(id)) return 2;
  if (/^G3_/.test(id)) return 3;
  if (/^G4_/.test(id)) return 4;
  if (/^P1_/.test(id)) return 5;
  if (/^P2_/.test(id)) return 6;
  if (/^P3_/.test(id)) return 7;
  if (id === "G_Endgame_Town") return 8;
  return null;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "ExileCompanionHUD/ingest" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function buildAreasDataset() {
  const rawAreas = JSON.parse(await fetchText(REPOE_POE2_AREAS_URL));
  const includedIds = new Set();

  for (const [id, area] of Object.entries(rawAreas)) {
    if (/DNT|UNUSED|WorldMap|_C$|ship$/i.test(id)) continue;
    if (/\[DNT/i.test(area?.name ?? "")) continue;
    if (resolveStageAct(id) === null) continue;
    includedIds.add(id);
  }

  const areas = {};
  for (const id of [...includedIds].sort()) {
    const raw = rawAreas[id];
    const act = resolveStageAct(id);
    const isTown = Boolean(raw.is_town);
    const conns = [...new Set((raw.connections ?? []).filter((c) => includedIds.has(c) && c !== id))];
    areas[id] = {
      id,
      name: String(raw.name ?? id).trim(),
      map_name: isTown ? String(raw.name ?? id).trim() : null,
      act,
      level: Number(raw.area_level ?? 1) || 1,
      has_waypoint: Boolean(raw.has_waypoint),
      is_town_area: isTown,
      parent_town_area_id: isTown ? null : (TOWN_BY_STAGE[act] ?? null),
      connection_ids: conns,
      crafting_recipes: [],
    };
  }
  return areas;
}

async function loadSpiritCostByGrantedEffect() {
  const map = new Map();
  for (const file of POB2_SKILL_FILES) {
    const lua = await fetchText(`${POB2_RAW_BASE}/src/Data/Skills/${file}`);
    for (const block of lua.split(/\nskills\["/).slice(1)) {
      const effectId = block.split('"')[0];
      const spiritMatch = /spiritReservationFlat\s*=\s*(\d+)/.exec(block);
      if (effectId && spiritMatch?.[1]) {
        map.set(effectId, Number.parseInt(spiritMatch[1], 10));
      }
    }
  }
  return map;
}

function derivePrimaryAttr(block) {
  const reqStr = Number.parseInt(/\breqStr\s*=\s*(\d+)/.exec(block)?.[1] ?? "0", 10);
  const reqDex = Number.parseInt(/\breqDex\s*=\s*(\d+)/.exec(block)?.[1] ?? "0", 10);
  const reqInt = Number.parseInt(/\breqInt\s*=\s*(\d+)/.exec(block)?.[1] ?? "0", 10);
  const max = Math.max(reqStr, reqDex, reqInt);
  if (max === 0) return "none";
  if (reqStr === max && reqStr > reqDex && reqStr > reqInt) return "strength";
  if (reqDex === max && reqDex > reqStr && reqDex > reqInt) return "dexterity";
  if (reqInt === max && reqInt > reqStr && reqInt > reqDex) return "intelligence";
  if (reqStr >= reqDex && reqStr >= reqInt) return "strength";
  if (reqDex >= reqInt) return "dexterity";
  return "intelligence";
}

function tierToRequiredLevel(tier, isSupport) {
  const table = isSupport ? SUPPORT_TIER_LEVEL_REQ : SKILL_TIER_LEVEL_REQ;
  const idx = Math.max(0, Math.min(table.length - 1, (tier || 1) - 1));
  return table[idx] ?? 1;
}

async function buildGemsDataset() {
  const [gemsLua, spiritByEffect] = await Promise.all([
    fetchText(`${POB2_RAW_BASE}/src/Data/Gems.lua`),
    loadSpiritCostByGrantedEffect(),
  ]);

  const gems = {};
  const aliases = {};

  for (const block of gemsLua.split(/\n\t\["/).slice(1)) {
    const luaKey = block.split('"')[0];
    const name = /\bname\s*=\s*"([^"]+)"/.exec(block)?.[1]?.trim();
    const gameId = /\bgameId\s*=\s*"([^"]+)"/.exec(block)?.[1]?.trim() || luaKey;
    const variantId = /\bvariantId\s*=\s*"([^"]+)"/.exec(block)?.[1]?.trim();
    const grantedEffectId = /\bgrantedEffectId\s*=\s*"([^"]+)"/.exec(block)?.[1]?.trim();
    const gemType = /\bgemType\s*=\s*"([^"]+)"/.exec(block)?.[1]?.trim() ?? "";
    const tier = Number.parseInt(/\bTier\s*=\s*(\d+)/.exec(block)?.[1] ?? "1", 10) || 1;
    if (!luaKey || !name || !gameId) continue;

    const tagsBlock = /\btags\s*=\s*\{([^}]*)\}/.exec(block)?.[1] ?? "";
    const hasMetaTag = /\bmeta\s*=\s*true/.test(tagsBlock);
    const hasBuffOrPersistent = /\b(buff|persistent)\s*=\s*true/.test(tagsBlock);
    const isSupport = gemType === "Support";
    const spiritCost = grantedEffectId ? (spiritByEffect.get(grantedEffectId) ?? 0) : 0;

    let gemKind = "skill";
    if (isSupport) gemKind = "support";
    else if (gemType === "Meta" || hasMetaTag) gemKind = "meta";
    else if (gemType === "Buff" || hasBuffOrPersistent || spiritCost > 0) gemKind = "spirit";

    gems[gameId] = {
      id: gameId,
      name,
      primary_attribute: derivePrimaryAttr(block),
      required_level: tierToRequiredLevel(tier, isSupport),
      is_support: isSupport,
      gem_kind: gemKind,
      uncut_tier: tier,
      ...(spiritCost > 0 ? { spirit_cost: spiritCost } : {}),
    };

    if (luaKey !== gameId) aliases[luaKey] = gameId;
    if (variantId && variantId !== gameId) aliases[variantId] = gameId;
    if (grantedEffectId && grantedEffectId !== gameId) aliases[grantedEffectId] = gameId;
  }

  return { gems, aliases, spiritCount: spiritByEffect.size };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const [areas, gemResult] = await Promise.all([buildAreasDataset(), buildGemsDataset()]);

  fs.writeFileSync(path.join(OUT_DIR, "areas.json"), `${JSON.stringify(areas, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    path.join(OUT_DIR, "gems.json"),
    `${JSON.stringify(gemResult.gems, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "gem_aliases.json"),
    `${JSON.stringify(gemResult.aliases, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Ingested PoE 2 datasets: ${Object.keys(areas).length} areas, ${Object.keys(gemResult.gems).length} gems, ${Object.keys(gemResult.aliases).length} aliases (${gemResult.spiritCount} spirit skills matched).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
