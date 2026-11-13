import { describe, expect, it } from "vitest";
import { deflate } from "pako";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  assignGemsToCampaignRoute,
  buildPobPreviewSummary,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  computeNextTownCurrencyBudget,
  extractPobBuild,
  filterExtractedPobBuildBySelection,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reconcilePobSetSelection,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
} from "../src/index.js";

function encodeBase64UrlPob(xml: string): string {
  const deflated = deflate(new TextEncoder().encode(xml));
  return Buffer.from(deflated).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const MULTI_SET_XML = `<PathOfBuilding>
  <Build className="Witch" ascendClassName="Elementalist" bandit="Alira" level="45" buildName="RF Elementalist Starter"/>
  <Skills>
    <SkillSet title="Act 1 (Lv 1-12)">
      <Skill enabled="true" label="Main Clear">
        <Gem enabled="true" nameSpec="Rolling Magma" gemId="Metadata/Items/Gems/SkillGemRollingMagma"/>
        <Gem enabled="true" nameSpec="Elemental Proliferation Support" gemId="Metadata/Items/Gems/SupportGemElementalProliferation"/>
      </Skill>
      <Skill enabled="true" label="Auras">
        <Gem enabled="true" nameSpec="Determination" gemId="Metadata/Items/Gems/SkillGemDetermination"/>
      </Skill>
    </SkillSet>
    <SkillSet title="Act 3 (Lv 28+)">
      <Skill enabled="true" label="RF Setup">
        <Gem enabled="true" nameSpec="Righteous Fire" gemId="Metadata/Items/Gems/SkillGemRighteousFire"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec title="Level 45" treeVersion="3_29" nodes="26725,44103"/></Tree>
</PathOfBuilding>`;

const ENDGAME_ONLY_XML = `<PathOfBuilding>
  <Build className="Marauder" ascendClassName="Chieftain" bandit="None" level="94" buildName="Endgame Chieftain"/>
  <Skills>
    <SkillSet title="Final Setup">
      <Skill enabled="true">
        <Gem enabled="true" nameSpec="Righteous Fire" gemId="Metadata/Items/Gems/SkillGemRighteousFire"/>
        <Gem enabled="true" nameSpec="Fireball" gemId="Metadata/Items/Gems/SkillGemFireball"/>
        <Gem enabled="true" nameSpec="Purity of Elements" gemId="Metadata/Items/Gems/SkillGemPurityOfElements"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec title="Endgame" treeVersion="3_29" nodes="44103"/></Tree>
</PathOfBuilding>`;

describe("PoB Decoder, Endgame Fallback & Route Gem Assigner", () => {
  it("decodes zlib base64url PoB code offline and detects multi-set leveling brackets", async () => {
    const code = encodeBase64UrlPob(MULTI_SET_XML);
    const decoded = await resolveAndDecodePobInput(code);
    expect(decoded.sourceKind).toBe("pob_code");

    const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
    const validated = validateAndEnrichPobBuild(extracted, poe1GameAdapter);

    expect(validated.buildName).toBe("RF Elementalist Starter");
    expect(validated.characterClass).toBe("Witch");
    expect(validated.bandit).toBe("Alira");
    expect(validated.isEndgameOnlyFallback).toBe(false);
    expect(validated.skillSets).toHaveLength(2);
    expect(validated.requiresAct3Library).toBe(true); // Witch needs Determination via Library/Lilly
  });

  it("activates Fallback Leveling Mode for single-set lvl 94 endgame-only PoBs", async () => {
    const decoded = await resolveAndDecodePobInput(ENDGAME_ONLY_XML);
    const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
    const validated = validateAndEnrichPobBuild(extracted, poe1GameAdapter);

    expect(validated.isEndgameOnlyFallback).toBe(true);
    expect(validated.fallbackNotice).toContain("Fallback Leveling Mode");
    expect(validated.skillSets[0]?.minLevel).toBe(1);
    expect(validated.skillSets.length).toBeGreaterThanOrEqual(2);
  });

  it("tags gems as FREE_QUEST_REWARD vs VENDOR_BUY and totals Act 1-3 currency budget", async () => {
    const decoded = await resolveAndDecodePobInput(MULTI_SET_XML);
    const validated = validateAndEnrichPobBuild(extractPobBuild(decoded.parsedXml, poe1GameAdapter), poe1GameAdapter);
    const defs = buildPreprocessorDefinitions({
      leagueStart: true,
      bandit: validated.bandit,
      includeLibrary: validated.requiresAct3Library,
    });
    const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
    const lines = preprocessRouteConditionals(raw, defs);
    const steps = parsePreprocessedRouteLines(lines, poe1GameAdapter);
    const gemSteps = assignGemsToCampaignRoute(validated, steps, poe1GameAdapter);

    const rollingMagma = gemSteps.find((g) => g.gemName === "Rolling Magma");
    const determination = gemSteps.find((g) => g.gemName === "Determination");
    expect(rollingMagma?.acquisitionType).toBe("FREE_QUEST_REWARD");
    expect(rollingMagma?.npcName).toBe("Tarkleigh");
    expect(determination?.acquisitionType).toBe("VENDOR_BUY");

    const budget = computeNextTownCurrencyBudget(gemSteps, 1);
    expect(budget.wisdom + budget.transmutation + budget.alteration + budget.chance + budget.alchemy).toBeGreaterThan(0);
  });

  it("extracts ItemSets and respects selective Passive/Skill/Item set filtering", async () => {
    const richXml = `<PathOfBuilding>
      <Build className="Witch" ascendClassName="Elementalist" bandit="Alira" level="72" buildName="Selective Set Build"/>
      <Skills>
        <SkillSet id="1" title="Act 1 Leveling">
          <Skill enabled="true" label="Starter">
            <Gem enabled="true" nameSpec="Rolling Magma" gemId="Metadata/Items/Gems/SkillGemRollingMagma"/>
          </Skill>
        </SkillSet>
        <SkillSet id="2" title="Endgame Mapping (Lv 68)">
          <Skill enabled="true" label="Endgame">
            <Gem enabled="true" nameSpec="Righteous Fire" gemId="Metadata/Items/Gems/SkillGemRighteousFire"/>
            <Gem enabled="true" nameSpec="Determination" gemId="Metadata/Items/Gems/SkillGemDetermination"/>
          </Skill>
        </SkillSet>
      </Skills>
      <Tree>
        <Spec id="tree_1" title="Act 1-3 Tree" treeVersion="3_29" nodes="26725"/>
        <Spec id="tree_2" title="Endgame Tree" treeVersion="3_29" nodes="26725,44103"/>
      </Tree>
      <Items activeItemSet="1">
        <Item id="1">
Rarity: RARE
^xFF8800Tempest Branch
Driftwood Wand
Sockets: B-B-G
LevelReq: 1
Implicits: 0
+1 to Level of all Fire Spell Skill Gems
25% increased Spell Damage
        </Item>
        <Item id="2">
Rarity: UNIQUE
Cloak of Flame
Scholar's Robe
Sockets: R-B-B-B
LevelReq: 18
Implicits: 0
{variant:1}40% of Physical Damage taken as Fire Damage
        </Item>
        <ItemSet id="1" title="Act 1 Gear">
          <Slot name="Weapon 1" itemId="1"/>
        </ItemSet>
        <ItemSet id="2" title="Endgame Gear (Lv 68)">
          <Slot name="Body Armour" itemId="2"/>
        </ItemSet>
      </Items>
    </PathOfBuilding>`;

    const decoded = await resolveAndDecodePobInput(richXml);
    const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
    const preview = buildPobPreviewSummary(extracted);

    expect(preview.passiveSpecs).toHaveLength(2);
    expect(preview.skillSets).toHaveLength(2);
    expect(preview.itemSets).toHaveLength(2);
    expect(extracted.itemSets[0]?.slots[0]?.itemName).toBe("Tempest Branch");
    expect(extracted.itemSets[0]?.slots[0]?.sockets).toBe("B-B-G");

    const filtered = filterExtractedPobBuildBySelection(extracted, {
      passiveSpecIds: ["tree_1"],
      skillSetIds: ["1"],
      itemSetIds: ["1"],
    });
    const validated = validateAndEnrichPobBuild(filtered, poe1GameAdapter);

    expect(validated.treeSpecs.map((s) => s.title)).toEqual(["Act 1-3 Tree"]);
    expect(validated.skillSets.map((s) => s.title)).toEqual(["Act 1 Leveling"]);
    expect(validated.itemSets.map((s) => s.title)).toEqual(["Act 1 Gear"]);
    expect(validated.uniqueRequiredGems.map((g) => g.id)).toEqual(["Metadata/Items/Gems/SkillGemMagmaOrb"]);
    expect(validated.isEndgameOnlyFallback).toBe(false);

    const noSkills = validateAndEnrichPobBuild(
      filterExtractedPobBuildBySelection(extracted, {
        passiveSpecIds: ["tree_1"],
        skillSetIds: [],
        itemSetIds: [],
      }),
      poe1GameAdapter,
    );
    expect(noSkills.skillSets).toHaveLength(0);
    expect(noSkills.isEndgameOnlyFallback).toBe(false);

    const reconciled = reconcilePobSetSelection(extracted, {
      passiveSpecIds: ["missing_old_id"],
      skillSetIds: [],
      itemSetIds: ["2"],
    });
    expect(reconciled.passiveSpecIds).toEqual(["tree_1", "tree_2"]);
    expect(reconciled.skillSetIds).toEqual([]);
    expect(reconciled.itemSetIds).toEqual(["2"]);
  });
});
