import {
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  computePassiveTreeDiff,
  extractPobBuild,
  parseClientLogLine,
  parsePobXmlString,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  type HudSessionSnapshot,
} from "@exile-hud/core";
import { loadPassiveTreeDataset, poe2GameAdapter } from "@exile-hud/game-data";

const DEMO_POE2_ALLOCATED_HASHES = [44683, 10364, 42857, 20024] as const;

const DEMO_POE2_XML = `<PathOfBuilding2>
  <Build className="Monk" ascendClassName="Invoker" bandit="None" level="24" buildName="PoE 2 Invoker Ice Strike"/>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="Act 1-3 Campaign (Lv 1-35)">
      <Skill enabled="true" label="Ice Strike Clear">
        <Gem enabled="true" nameSpec="Ice Strike" gemId="Metadata/Items/Gems/SkillGemIceStrike" level="6" quality="0"/>
        <Gem enabled="true" nameSpec="Rapid Attacks I" gemId="Metadata/Items/Gems/SupportGemMartialTempo" level="1" quality="0"/>
        <Gem enabled="true" nameSpec="Cold Attunement" gemId="Metadata/Items/Gems/SupportGemColdInfusion" level="1" quality="0"/>
        <Gem enabled="true" nameSpec="Ice Bite I" gemId="Metadata/Items/Gems/SupportGemIceBite" level="1" quality="0"/>
      </Skill>
      <Skill enabled="true" label="Tempest Bell Boss">
        <Gem enabled="true" nameSpec="Tempest Bell" gemId="Metadata/Items/Gem/SkillGemTempestBell" level="6" quality="0"/>
        <Gem enabled="true" nameSpec="Overabundance I" gemId="Metadata/Items/Gems/SupportGemOverabundance" level="1" quality="0"/>
        <Gem enabled="true" nameSpec="Magnified Area I" gemId="Metadata/Items/Gems/SupportGemMagnifiedEffect" level="1" quality="0"/>
      </Skill>
      <Skill enabled="true" label="Spirit Reservations">
        <Gem enabled="true" nameSpec="Herald of Ice" gemId="Metadata/Items/Gems/SkillGemHeraldOfIce" level="4" quality="0"/>
        <Gem enabled="true" nameSpec="Wind Dancer" gemId="Metadata/Items/Gem/SkillGemWindDancer" level="4" quality="0"/>
        <Gem enabled="true" nameSpec="Ghost Dance" gemId="Metadata/Items/Gems/SkillGemGhostDance" level="4" quality="0"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec id="1" title="Act 2 Transition (Lv 24)" treeVersion="poe2_0_5" nodes="44683,10364,42857,20024,44223,7576,33866,52980,18970">
      <WeaponSet1 nodes="20024,44223"/>
      <WeaponSet2 nodes="7576,33866"/>
    </Spec>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
Frostbite Stave
Crescent Quarterstaff
LevelReq: 18
Implicits: 0
Adds 12 to 24 Cold Damage
14% increased Attack Speed
    </Item>
    <Item id="2">
Rarity: UNIQUE
Goldrim
Felt Cap
LevelReq: 1
Implicits: 0
+30% to all Elemental Resistances
    </Item>
    <ItemSet id="1" title="Act 2 Campaign (Lv 18)">
      <Slot name="Weapon 1" itemId="1"/>
      <Slot name="Helmet" itemId="2"/>
    </ItemSet>
  </Items>
</PathOfBuilding2>`;

function compileDemoPoe2Extracted() {
  const parsed = parsePobXmlString(DEMO_POE2_XML);
  return extractPobBuild(parsed, poe2GameAdapter);
}

/** Synchronously builds a rich PoE 2 Monk/Invoker demo snapshot (recomputes tree once lazy JSON loads). */
export function createPoe2DemoSnapshotSync(): HudSessionSnapshot {
  const extracted = compileDemoPoe2Extracted();
  const build = {
    ...extracted,
    isEndgameOnlyFallback: false,
    fallbackNotice: null,
    requiresAct3Library: false,
  };
  const defs = buildPreprocessorDefinitions({ leagueStart: false, bandit: "None", includeLibrary: false });
  const rawRoute = combineRouteActFiles(poe2GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(rawRoute, defs), poe2GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe2GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, poe2GameAdapter);

  let snap = buildInitialSessionSnapshot({
    roomId: "DEMO02",
    profileId: "demo-poe2-invoker",
    build,
    checkpoints,
    gemSteps,
    adapter: poe2GameAdapter,
    characterName: "ExileMonk",
  });

  snap = reduceTelemetrySession(snap, { type: "process_state", running: true }, poe2GameAdapter);
  const freythorn = parseClientLogLine(
    '2026/11/24 00:01:00 100 [DEBUG Client 1] Generating level 11 area "G1_12" with seed 1122',
  )!;
  snap = reduceTelemetrySession(snap, { type: "client_log", event: freythorn, autoDetectCharacter: true }, poe2GameAdapter);
  const traitorsPassage = parseClientLogLine(
    '2026/11/24 00:05:00 100 [DEBUG Client 1] Generating level 19 area "G2_2" with seed 2202',
  )!;
  snap = reduceTelemetrySession(
    snap,
    { type: "client_log", event: traitorsPassage, autoDetectCharacter: true },
    poe2GameAdapter,
  );

  const passiveTree = computePassiveTreeDiff({
    treeSpecs: extracted.treeSpecs,
    allocatedHashes: [...DEMO_POE2_ALLOCATED_HASHES],
    characterLevel: 24,
    adapter: poe2GameAdapter,
  });

  return {
    ...snap,
    gameId: "poe2",
    leagueStart: false,
    passiveTree,
    characterLevel: 24,
    equippedItemNames: ["goldrim"],
    runElapsedMs: 215_000,
    runTimerRunning: true,
    actSplitsMs: { act_1: 184_000 },
    resistances: {
      ...snap.resistances,
      source: "API_VERIFIED",
      fire: { actual: 22, target: 40 },
      cold: { actual: 38, target: 40 },
      lightning: { actual: 14, target: 50 },
      chaos: { actual: 0, target: 0 },
    },
  };
}

/** Recomputes PoE 2 passive tree coordinates/notables after lazy JSON hydration while preserving state. */
export function recomputePoe2DemoPassiveTree(snapshot: HudSessionSnapshot): HudSessionSnapshot {
  const passiveTree = computePassiveTreeDiff({
    treeSpecs: compileDemoPoe2Extracted().treeSpecs,
    allocatedHashes: [...DEMO_POE2_ALLOCATED_HASHES],
    characterLevel: snapshot.characterLevel,
    adapter: poe2GameAdapter,
  });
  return { ...snapshot, passiveTree };
}

/** Ensures the lazy PoE 2 passive tree dataset is loaded, then creates the full PoE 2 demo snapshot. */
export async function createPoe2DemoSnapshot(): Promise<HudSessionSnapshot> {
  await loadPassiveTreeDataset("poe2");
  return createPoe2DemoSnapshotSync();
}
