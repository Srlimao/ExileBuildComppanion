import type { SupportedGameId } from "@exile-hud/game-data";
import { XMLParser } from "fast-xml-parser";
import { inflate } from "pako";

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
  sourceKind: "xml" | "pob_code" | "pobbin_url";
  detectedGameId: SupportedGameId;
  xmlString: string;
  parsedXml: Record<string, any>;
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

export async function resolveAndDecodePobInput(
  rawOrUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<DecodedPobDocument> {
  const trimmed = rawOrUrl.trim();
  if (!trimmed) {
    throw new Error("PoB input is empty.");
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

  const sourceKind = trimmed.startsWith("<") ? "xml" : "pob_code";
  const xmlString = decodePobCodeToXmlString(trimmed);
  const parsedXml = xmlParser.parse(xmlString) as Record<string, any>;
  if (!parsedXml.PathOfBuilding && !parsedXml.PathOfBuilding2) {
    throw new Error("Decoded XML does not contain a <PathOfBuilding> or <PathOfBuilding2> root element.");
  }
  const { detectedGameId } = getPobXmlRoot(parsedXml);
  return { sourceKind, detectedGameId, xmlString, parsedXml };
}
