import { getGameAdapter } from "@exile-hud/game-data";
import { deflate } from "pako";
import { describe, expect, it } from "vitest";
import {
  assignGemsToCampaignRoute,
  buildPreprocessorDefinitions,
  buildVendorSearchRegex,
  combineRouteActFiles,
  computePassiveTreeDiff,
  extractPobBuild,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
} from "../src/index.js";

const SAMPLE_POE2_XML = `<PathOfBuilding2>
  <Build className="Monk" ascendClassName="Invoker" bandit="None" level="85" buildName="Ice Strike Invoker"/>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="Endgame Mapping">
      <Skill enabled="true" label="Primary Attack">
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemIceStrike" nameSpec="Ice Strike" level="18" quality="20"/>
        <Gem enabled="true" gemId="Metadata/Items/Gems/SupportGemMartialTempo" nameSpec="Rapid Attacks I" level="1" quality="0"/>
      </Skill>
      <Skill enabled="true" label="Bell &amp; Buffs">
        <Gem enabled="true" skillId="TempestBellPlayer" nameSpec="Tempest Bell" level="18" quality="0"/>
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemHeraldOfIce" nameSpec="Herald of Ice" level="18" quality="0"/>
        <Gem enabled="true" gemId="Metadata/Items/Gem/SkillGemArchmage" nameSpec="Archmage" level="18" quality="0"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec id="1" title="Endgame Invoker" treeVersion="poe2_0_4" nodes="101,102,103">
      <WeaponSet1 nodes="101,102"/>
      <WeaponSet2 nodes="103"/>
    </Spec>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">Rarity: UNIQUE
Enfolding Dawn
Pilgrim Vestments
Variant: Current
+100 to Spirit</Item>
    <ItemSet id="1" title="Campaign Swap">
      <Slot name="Body Armour" itemId="1"/>
    </ItemSet>
  </Items>
</PathOfBuilding2>`;

function encodePobCode(xml: string): string {
  const bytes = deflate(new TextEncoder().encode(xml));
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("poe2_pob_import_and_gems", () => {
  const poe2 = getGameAdapter("poe2");

  it("decodes compressed <PathOfBuilding2> codes and distinguishes PoE 2 vs PoE 1", async () => {
    const encoded = encodePobCode(SAMPLE_POE2_XML);
    const decoded = await resolveAndDecodePobInput(encoded);
    expect(decoded.sourceKind).toBe("pob_code");
    expect(decoded.detectedGameId).toBe("poe2");

    const poe1Doc = await resolveAndDecodePobInput("<PathOfBuilding><Build level=\"1\"/></PathOfBuilding>");
    expect(poe1Doc.detectedGameId).toBe("poe1");
  });

  it("extracts WeaponSet1 / WeaponSet2 node lists and ItemSets from PoB 2 XML", async () => {
    const decoded = await resolveAndDecodePobInput(SAMPLE_POE2_XML);
    const extracted = extractPobBuild(decoded.parsedXml, poe2);

    expect(extracted.detectedGameId).toBe("poe2");
    expect(extracted.characterClass).toBe("Monk");
    expect(extracted.ascendancyName).toBe("Invoker");
    expect(extracted.treeSpecs[0]?.weaponSet1NodeIds).toEqual(["101", "102"]);
    expect(extracted.treeSpecs[0]?.weaponSet2NodeIds).toEqual(["103"]);
    expect(extracted.itemSets[0]?.slots[0]?.itemName).toBe("Enfolding Dawn");

    const treeDiff = computePassiveTreeDiff({
      treeSpecs: extracted.treeSpecs,
      allocatedHashes: [101],
      characterLevel: 30,
      adapter: poe2,
    });
    expect(treeDiff.specs?.[0]?.weaponSet1NodeIds).toEqual(["101", "102"]);
    expect(treeDiff.specs?.[0]?.weaponSet2NodeIds).toEqual(["103"]);
  });

  it("resolves PoE 2 gems by gemId/skillId aliases, plans Uncut tiers, and builds PoE 2 vendor regex", async () => {
    const decoded = await resolveAndDecodePobInput(SAMPLE_POE2_XML);
    const extracted = extractPobBuild(decoded.parsedXml, poe2);
    const validated = validateAndEnrichPobBuild(extracted, poe2);

    expect(validated.requiresAct3Library).toBe(false);

    const routeSource = combineRouteActFiles(poe2.getDefaultRouteFiles());
    const lines = preprocessRouteConditionals(
      routeSource,
      buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: false }),
    );
    const steps = parsePreprocessedRouteLines(lines, poe2);
    const gemSteps = assignGemsToCampaignRoute(validated, steps, poe2);

    const names = gemSteps.map((g) => g.gemName);
    expect(names).toEqual(
      expect.arrayContaining(["Ice Strike", "Tempest Bell", "Herald of Ice", "Archmage", "Rapid Attacks I"]),
    );

    const herald = gemSteps.find((g) => g.gemName === "Herald of Ice")!;
    expect(herald.gemKind).toBe("spirit");
    expect(herald.uncutTier).toBe(4);
    expect(herald.spiritCost).toBe(30);
    expect(herald.questName).toContain("Uncut Spirit Gem");

    const archmage = gemSteps.find((g) => g.gemName === "Archmage")!;
    expect(archmage.gemKind).toBe("spirit");
    expect(archmage.spiritCost).toBe(100);

    const regex = buildVendorSearchRegex({
      gemSteps,
      linkGroups: [],
      currentAct: 2,
      gameId: "poe2",
    });
    expect(regex.length).toBeGreaterThan(0);
    expect(regex.length).toBeLessThanOrEqual(50);
    expect(regex).toContain("m.*sp");
    expect(regex).toContain("spirit");
    expect(regex).not.toMatch(/r-g|g-r|b-g|r-b/);
  });
});
