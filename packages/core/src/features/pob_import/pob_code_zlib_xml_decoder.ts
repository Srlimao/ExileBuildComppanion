import type { SupportedGameId } from "@exile-hud/game-data";
import { XMLParser } from "fast-xml-parser";
import { inflate } from "pako";
import { extractMaxrollPobId, fetchMaxrollPobCode } from "./maxroll_pob_url_resolver.js";
import { isDirectBuildFileUrl, isPoe2BuildJsonString } from "./poe2_build_file_schema.js";

const MAX_BUILD_JSON_BYTES = 2 * 1024 * 1024;

const ARRAY_TAG_NAMES = new Set([
  "SkillSet",
  "Skill",
  "Gem",
  "Spec",
  "URL",
  "Slot",
  "Item",
  "ItemSet",
  "WeaponSet1",
  "WeaponSet2",
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  trimValues: true,
  isArray: (tagName) => ARRAY_TAG_NAMES.has(tagName),
});

export interface DecodedPobDocument {
  sourceKind: "xml" | "pob_code" | "pobbin_url" | "maxroll_pob_url" | "poe2_build_json" | "poe2_build_url";
  detectedGameId: SupportedGameId;
  xmlString: string;
  parsedXml: Record<string, any>;
  rawBuildJson?: Record<string, any>;
}

/** Extracts the `<PathOfBuilding>` or `<PathOfBuilding2>` root node and detected game ID. */
export function getPobXmlRoot(parsedXml: Record<string, any>): {
  root: Record<string, any>;
  detectedGameId: SupportedGameId;
} {
  if (parsedXml?.PathOfBuilding2 && typeof parsedXml.PathOfBuilding2 === "object") {
    return { root: parsedXml.PathOfBuilding2 as Record<string, any>, detectedGameId: "poe2" };
  }
  if (parsedXml?.PathOfBuilding && typeof parsedXml.PathOfBuilding === "object") {
    return { root: parsedXml.PathOfBuilding as Record<string, any>, detectedGameId: "poe1" };
  }
  return { root: {}, detectedGameId: "poe1" };
}

export function decodeBase64UrlToBytes(input: string): Uint8Array {
  const normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array(Buffer.from(padded, "base64"));
}

export function extractPobbinId(input: string): string | null {
  const trimmed = input.trim();
  const match = /^https?:\/\/(?:www\.)?pobb\.in\/([a-zA-Z0-9_-]+)/i.exec(trimmed);
  return match?.[1] ?? null;
}

export function parsePobXmlString(xmlString: string): Record<string, any> {
  return xmlParser.parse(xmlString) as Record<string, any>;
}

export function decodePobCodeToXmlString(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.startsWith("<")) {
    return trimmed;
  }
  const compressed = decodeBase64UrlToBytes(trimmed);
  const inflated = inflate(compressed);
  return new TextDecoder("utf-8").decode(inflated);
}

function parseBuildJsonObject(rawText: string): Record<string, any> {
  if (rawText.length > MAX_BUILD_JSON_BYTES) {
    throw new Error("The .build JSON payload exceeds the 2 MB size limit.");
  }
  if (!isPoe2BuildJsonString(rawText)) {
    throw new Error("Input is not a valid Path of Exile 2 .build JSON document.");
  }
  return JSON.parse(rawText) as Record<string, any>;
}

export async function resolveAndDecodePobInput(
  rawOrUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DecodedPobDocument> {
  const trimmed = rawOrUrl.trim();
  if (!trimmed) {
    throw new Error("PoB or .build input is empty.");
  }

  if (isPoe2BuildJsonString(trimmed)) {
    const rawBuildJson = parseBuildJsonObject(trimmed);
    return {
      sourceKind: "poe2_build_json",
      detectedGameId: "poe2",
      xmlString: trimmed,
      parsedXml: {},
      rawBuildJson,
    };
  }

  if (isDirectBuildFileUrl(trimmed)) {
    const response = await fetcher(trimmed);
    if (!response.ok) {
      throw new Error(`.build URL returned HTTP ${response.status}.`);
    }
    const rawText = (await response.text()).trim();
    const rawBuildJson = parseBuildJsonObject(rawText);
    return {
      sourceKind: "poe2_build_url",
      detectedGameId: "poe2",
      xmlString: rawText,
      parsedXml: {},
      rawBuildJson,
    };
  }

  const pobbinId = extractPobbinId(trimmed);
  if (pobbinId) {
    const response = await fetcher(`https://pobb.in/${pobbinId}/raw`);
    if (!response.ok) {
      throw new Error(`pobb.in returned HTTP ${response.status} (paste raw PoB export code for offline mode).`);
    }
    const rawCode = await response.text();
    const xmlString = decodePobCodeToXmlString(rawCode);
    const parsedXml = xmlParser.parse(xmlString) as Record<string, any>;
    if (!parsedXml.PathOfBuilding && !parsedXml.PathOfBuilding2) {
      throw new Error("Decoded XML does not contain a <PathOfBuilding> or <PathOfBuilding2> root element.");
    }
    const { detectedGameId } = getPobXmlRoot(parsedXml);
    return { sourceKind: "pobbin_url", detectedGameId, xmlString, parsedXml };
  }

  const maxrollPobId = extractMaxrollPobId(trimmed);
  if (maxrollPobId) {
    const rawCode = await fetchMaxrollPobCode(maxrollPobId, fetcher);
    const xmlString = decodePobCodeToXmlString(rawCode);
    const parsedXml = xmlParser.parse(xmlString) as Record<string, any>;
    if (!parsedXml.PathOfBuilding && !parsedXml.PathOfBuilding2) {
      throw new Error("Decoded XML does not contain a <PathOfBuilding> or <PathOfBuilding2> root element.");
    }
    const { detectedGameId } = getPobXmlRoot(parsedXml);
    return { sourceKind: "maxroll_pob_url", detectedGameId, xmlString, parsedXml };
  }

  const sourceKind = trimmed.startsWith("<") ? "xml" : "pob_code";
  const xmlString = decodePobCodeToXmlString(trimmed);
  const parsedXml = xmlParser.parse(xmlString) as Record<string, any>;
  if (!parsedXml.PathOfBuilding && !parsedXml.PathOfBuilding2) {
    throw new Error("Decoded XML does not contain a <PathOfBuilding> or <PathOfBuilding2> root element.");
  }
  const { detectedGameId } = getPobXmlRoot(parsedXml);
  return { sourceKind, detectedGameId, xmlString, parsedXml };
}
