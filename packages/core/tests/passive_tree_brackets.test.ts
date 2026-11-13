import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  buildInitialSessionSnapshot,
  computeBracketProgressionDiff,
  computePassiveTreeDiff,
  computeShortestPathToNode,
  extractPobBuild,
  parseClientLogLine,
  parsePobXmlString,
  reduceTelemetrySession,
  resolveMasteryEffectStats,
  selectBracketSpecIndex,
  sortTreeSpecsByLevel,
} from "../src/index.js";

const MULTI_SPEC_POB_XML = `<PathOfBuilding>
  <Build className="Witch" ascendClassName="Elementalist" bandit="Alira" level="75" buildName="Witch Bracket Test"/>
  <Skills>
    <SkillSet title="Act 1">
      <Skill enabled="true" label="Main">
        <Gem enabled="true" nameSpec="Rolling Magma" gemId="Metadata/Items/Gems/SkillGemMagmaOrb"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="2">
    <Spec id="3" title="Endgame (Lv 75)" treeVersion="3_30" masteryEffects="{34927,24180}" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,14936,44184,61804,14040,18715,10893,60501,34927,16023,12738,53123,37114,61259"/>
    <Spec id="1" title="Act 1 (Lv 1-12)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,57226,21678,32210,8948,27929"/>
    <Spec id="2" title="Act 3 Transition (Lv 28)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,16023,12738,53123"/>
  </Tree>
  <Items activeItemSet="1"><ItemSet id="1" title="Start"/></Items>
</PathOfBuilding>`;

describe("passive tree level brackets, mastery extraction, and HUD TREE state", () => {
  it("extracts unsorted PoB <Spec masteryEffects> and resolves GGG 3.30.0 Fire Mastery stats", () => {
    const parsed = parsePobXmlString(MULTI_SPEC_POB_XML);
    const build = extractPobBuild(parsed, poe1GameAdapter);

    expect(build.treeSpecs).toHaveLength(3);
    const sorted = sortTreeSpecsByLevel(build.treeSpecs);
    expect(sorted.map((s) => s.title)).toEqual([
      "Act 1 (Lv 1-12)",
      "Act 3 Transition (Lv 28)",
      "Endgame (Lv 75)",
    ]);

    const endgame = sorted[2]!;
    expect(endgame.masteries["34927"]).toBe("24180");
    const masteryStats = resolveMasteryEffectStats("34927", endgame.masteries["34927"], poe1GameAdapter);
    expect(masteryStats).toBeTruthy();
    expect(masteryStats!.length).toBeGreaterThan(0);
  });

  it("computes bracket progression diff with respecs, additions, and future nodes", () => {
    const parsed = parsePobXmlString(MULTI_SPEC_POB_XML);
    const build = extractPobBuild(parsed, poe1GameAdapter);
    const specs = sortTreeSpecsByLevel(
      build.treeSpecs.map((s) => ({
        id: s.id,
        title: s.title,
        minLevel: s.minLevel,
        treeVersion: s.treeVersion,
        nodeIds: s.nodeIds,
        masteries: s.masteries,
      })),
    );

    // At characterLevel 30, Act 3 Transition (Lv 28) is auto-selected
    expect(selectBracketSpecIndex(specs, 30)).toBe(1);
    expect(selectBracketSpecIndex(specs, 30, specs[2]!.id)).toBe(2);

    const allocated = new Set(["54447", "57264", "37569", "36542", "4397", "11420", "57226", "21678"]);
    const diff = computeBracketProgressionDiff({
      specs,
      selectedIndex: 1,
      allocatedIds: allocated,
      characterClass: "Witch",
      adapter: poe1GameAdapter,
    });

    expect(diff.selectedSpec?.title).toBe("Act 3 Transition (Lv 28)");
    expect(diff.allocatedInTargetIds).toEqual(["54447", "57264", "37569", "36542", "4397", "11420"]);
    expect(diff.addedInBracketIds).toContain("22088");
    expect(diff.respecFromPrevIds).toEqual(expect.arrayContaining(["57226", "21678"]));
    expect(diff.futureBracketIds).toEqual(expect.arrayContaining(["60501", "34927"]));
    expect(diff.nextNotableTargets.map((t) => t.nodeId)).toEqual(expect.arrayContaining(["21958", "22088"]));
  });

  it("computes shortest connected paths to keystones and wheel-center masteries", () => {
    const parsed = parsePobXmlString(MULTI_SPEC_POB_XML);
    const build = extractPobBuild(parsed, poe1GameAdapter);
    const specs = sortTreeSpecsByLevel(
      build.treeSpecs.map((s) => ({
        id: s.id,
        title: s.title,
        minLevel: s.minLevel,
        treeVersion: s.treeVersion,
        nodeIds: s.nodeIds,
        masteries: s.masteries,
      })),
    );
    const endgameSet = new Set(specs[2]!.nodeIds);
    const allocated = new Set(["54447", "57264", "37569", "36542", "4397", "11420"]);

    const toEo = computeShortestPathToNode({
      targetNodeId: "22088",
      targetSet: endgameSet,
      allocatedIds: allocated,
      characterClass: "Witch",
      adapter: poe1GameAdapter,
    });
    expect(toEo[toEo.length - 1]).toBe("22088");
    expect(toEo.length).toBeGreaterThanOrEqual(4);

    const toMastery = computeShortestPathToNode({
      targetNodeId: "34927",
      targetSet: endgameSet,
      allocatedIds: new Set([...allocated, ...toEo]),
      characterClass: "Witch",
      adapter: poe1GameAdapter,
    });
    expect(toMastery).toContain("60501");
    expect(toMastery[toMastery.length - 1]).toBe("34927");
  });

  it("tracks allocatedHashes in computePassiveTreeDiff and auto-resets inGameTreeOpen on zone or exit", () => {
    const parsed = parsePobXmlString(MULTI_SPEC_POB_XML);
    const build = extractPobBuild(parsed, poe1GameAdapter);
    const diff = computePassiveTreeDiff({
      treeSpecs: build.treeSpecs,
      allocatedHashes: [54447, 57264, 11420],
      characterLevel: 1,
      adapter: poe1GameAdapter,
    });
    expect(diff.allocatedNodeIds).toEqual(["54447", "57264", "11420"]);
    expect(diff.allocatedTargetCount).toBeGreaterThan(0);

    let snap = buildInitialSessionSnapshot({
      roomId: "TREE01",
      profileId: "tree-test",
      build: { ...build, isEndgameOnlyFallback: false, fallbackNotice: null, requiresAct3Library: false },
      checkpoints: [],
      gemSteps: [],
      adapter: poe1GameAdapter,
    });

    snap = reduceTelemetrySession(snap, { type: "in_game_tree_state", open: true }, poe1GameAdapter);
    expect(snap.inGameTreeOpen).toBe(true);

    const coastLog = parseClientLogLine('2026/11/13 [INFO Client 1] Generating level 2 area "1_1_2" with seed 12345')!;
    snap = reduceTelemetrySession(
      snap,
      { type: "client_log", event: coastLog, autoDetectCharacter: false },
      poe1GameAdapter,
    );
    expect(snap.inGameTreeOpen).toBe(false);

    snap = reduceTelemetrySession(snap, { type: "in_game_tree_state", open: true }, poe1GameAdapter);
    snap = reduceTelemetrySession(snap, { type: "process_state", running: false }, poe1GameAdapter);
    expect(snap.inGameTreeOpen).toBe(false);
    expect(snap.mode).toBe("STANDBY");
  });
});
