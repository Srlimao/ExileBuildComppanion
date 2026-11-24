import { deflate } from "pako";
import { describe, expect, it } from "vitest";
import {
  extractMaxrollPobId,
  fetchMaxrollPobCode,
} from "../src/features/pob_import/maxroll_pob_url_resolver.js";
import { resolveAndDecodePobInput } from "../src/features/pob_import/pob_code_zlib_xml_decoder.js";

function encodeXmlToPobCode(xml: string): string {
  const compressed = deflate(new TextEncoder().encode(xml));
  return Buffer.from(compressed)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("maxroll_pob_url_resolver", () => {
  it("extracts profile ids from Maxroll PoB and planner URLs", () => {
    expect(extractMaxrollPobId("https://maxroll.gg/poe/pob/dtjsf0o0")).toBe("dtjsf0o0");
    expect(extractMaxrollPobId("https://planners.maxroll.gg/profiles/load/poe/abc_123")).toBe(
      "abc_123",
    );
    expect(extractMaxrollPobId("https://pobb.in/Wpo4TuYfRXFT")).toBeNull();
  });

  it("resolves and decodes Maxroll PoB links inside resolveAndDecodePobInput", async () => {
    const sampleXml = `<PathOfBuilding><Build className="Witch" ascendClassName="Necromancer" level="95"/></PathOfBuilding>`;
    const pobCode = encodeXmlToPobCode(sampleXml);

    const mockFetch: typeof fetch = async (input) => {
      expect(String(input)).toBe("https://planners.maxroll.gg/profiles/load/poe/dtjsf0o0");
      return new Response(
        JSON.stringify({
          id: "dtjsf0o0",
          name: "Min-Max Golems",
          data: JSON.stringify({ pobCode }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    expect(await fetchMaxrollPobCode("dtjsf0o0", mockFetch)).toBe(pobCode);

    const decoded = await resolveAndDecodePobInput(
      "https://maxroll.gg/poe/pob/dtjsf0o0",
      mockFetch,
    );
    expect(decoded.sourceKind).toBe("maxroll_pob_url");
    expect(decoded.detectedGameId).toBe("poe1");
    expect(decoded.xmlString).toContain("Necromancer");
  });
});
