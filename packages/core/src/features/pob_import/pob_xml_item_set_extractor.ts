import { cleanPobColorCodes, inferLevelFromTitle } from "./pob_xml_text_helpers.js";

export interface ExtractedItemSlotEntry {
  slotName: string;
  itemId: string;
  itemName: string;
  baseType: string;
  rarity: "normal" | "magic" | "rare" | "unique" | "unknown";
  sockets: string;
  levelReq: number;
  mods: string[];
}

export interface ExtractedItemSet {
  id: string;
  title: string;
  minLevel: number;
  slots: ExtractedItemSlotEntry[];
}

const META_PREFIX_REGEX =
  /^(?:Unique ID:|Item Level:|Quality:|Sockets:|LevelReq:|Implicits:|Selected Variant:|Has Alt Variant|Variant:|Crafted:|Prefix:|Suffix:|Armour:|Evasion:|Energy Shield:|Ward:|Radius:|Limited to:|Requires |Note:|League:|Catalyst|Talisman|Foil|Shaper|Elder|Crusader|Hunter|Redeemer|Warlord|Fractured|Synthesised|Corrupted|Mirrored|Split|Unidentified|[-]{3,})/;

function normalizeRarity(value: string): ExtractedItemSlotEntry["rarity"] {
  const lower = value.trim().toLowerCase();
  if (lower === "normal" || lower === "magic" || lower === "rare" || lower === "unique") {
    return lower;
  }
  return "unknown";
}

function matchesSelectedVariant(line: string, selectedVariant: string | null): boolean {
  if (!selectedVariant) return true;
  const match = /\{variant:([^}]+)\}/.exec(line);
  if (!match?.[1]) return true;
  return match[1].split(",").map((s) => s.trim()).includes(selectedVariant);
}

function stripPobModTags(line: string): string {
  return line.replace(/\{[^}]+\}/g, "").trim();
}

/** Parses an individual PoB <Item> text block into structured slot metadata and mods. */
export function parsePobRawItemText(
  rawText: string,
  itemId: string,
  slotName = "Equipped",
): ExtractedItemSlotEntry {
  const lines = cleanPobColorCodes(rawText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let rarity: ExtractedItemSlotEntry["rarity"] = "unknown";
  let cursor = 0;
  if (lines[0]?.startsWith("Rarity:")) {
    rarity = normalizeRarity(lines[0].slice("Rarity:".length));
    cursor = 1;
  }

  let selectedVariant: string | null = null;
  let sockets = "";
  let levelReq = 1;
  const headerLines: string[] = [];
  const modLines: string[] = [];
  let inMods = false;

  for (let i = cursor; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.startsWith("Selected Variant:")) {
      selectedVariant = line.slice("Selected Variant:".length).trim();
      continue;
    }
    if (line.startsWith("Sockets:")) {
      sockets = line.slice("Sockets:".length).trim();
      inMods = true;
      continue;
    }
    if (line.startsWith("LevelReq:")) {
      const parsed = Number.parseInt(line.slice("LevelReq:".length).trim(), 10);
      if (Number.isFinite(parsed)) levelReq = parsed;
      inMods = true;
      continue;
    }
    if (line.startsWith("Implicits:")) {
      inMods = true;
      continue;
    }
    if (META_PREFIX_REGEX.test(line)) {
      inMods = true;
      continue;
    }

    if (!inMods && headerLines.length < (rarity === "rare" || rarity === "unique" ? 2 : 1)) {
      headerLines.push(line);
    } else {
      inMods = true;
      if (matchesSelectedVariant(line, selectedVariant)) {
        const cleanedMod = stripPobModTags(line);
        if (cleanedMod && modLines.length < 6) {
          modLines.push(cleanedMod);
        }
      }
    }
  }

  const itemName = headerLines[0] ?? `Item #${itemId}`;
  const baseType = headerLines[1] ?? itemName;

  return {
    slotName,
    itemId,
    itemName,
    baseType,
    rarity,
    sockets,
    levelReq,
    mods: modLines,
  };
}

function buildItemLookupMap(itemsNode: any): Map<string, string> {
  const map = new Map<string, string>();
  const rawItems: any[] = Array.isArray(itemsNode?.Item) ? itemsNode.Item : [];
  for (const itemEl of rawItems) {
    const id = String(itemEl?.["@_id"] ?? "");
    const rawText = typeof itemEl === "string" ? itemEl : String(itemEl?.["#text"] ?? "");
    if (id && rawText) map.set(id, rawText);
  }
  return map;
}

function mapRawSlotsToEntries(rawSlots: any[], itemLookup: Map<string, string>): ExtractedItemSlotEntry[] {
  const entries: ExtractedItemSlotEntry[] = [];
  for (const slotEl of rawSlots) {
    const slotName = cleanPobColorCodes(slotEl?.["@_name"]);
    const itemId = String(slotEl?.["@_itemId"] ?? "0");
    if (!slotName || !itemId || itemId === "0") continue;
    const rawText = itemLookup.get(itemId);
    if (!rawText) continue;
    entries.push(parsePobRawItemText(rawText, itemId, slotName));
  }
  return entries;
}

/** Extracts all named <ItemSet> blocks (or fallback top-level <Slot> entries) from parsed PoB XML. */
export function extractPobItemSets(parsedXml: any, buildLevelFallback = 1): ExtractedItemSet[] {
  const itemsNode = parsedXml?.PathOfBuilding?.Items;
  if (!itemsNode) return [];

  const itemLookup = buildItemLookupMap(itemsNode);
  const rawItemSets: any[] = Array.isArray(itemsNode.ItemSet) ? itemsNode.ItemSet : [];

  if (rawItemSets.length > 0) {
    return rawItemSets.map((setEl, idx) => {
      const id = String(setEl?.["@_id"] ?? `itemset_${idx + 1}`);
      const title = cleanPobColorCodes(setEl?.["@_title"]) || `Gear Set ${idx + 1}`;
      const rawSlots: any[] = Array.isArray(setEl?.Slot) ? setEl.Slot : [];
      const slots = mapRawSlotsToEntries(rawSlots, itemLookup);
      const maxSlotReq = slots.reduce((max, s) => Math.max(max, s.levelReq), 1);
      return {
        id,
        title,
        minLevel: inferLevelFromTitle(title, idx === 0 && rawItemSets.length > 1 ? 1 : maxSlotReq || buildLevelFallback),
        slots,
      };
    });
  }

  const fallbackSlots: any[] = Array.isArray(itemsNode.Slot) ? itemsNode.Slot : [];
  const entries = mapRawSlotsToEntries(fallbackSlots, itemLookup);
  if (entries.length === 0) return [];

  const maxSlotReq = entries.reduce((max, s) => Math.max(max, s.levelReq), buildLevelFallback);
  return [
    {
      id: "default_items",
      title: "Default Gear",
      minLevel: Math.min(buildLevelFallback, maxSlotReq || buildLevelFallback),
      slots: entries,
    },
  ];
}
