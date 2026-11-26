import { poe1GameAdapter } from "@exile-hud/game-data";
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
  selectActiveSkillSet,
  type HudSessionSnapshot,
} from "@exile-hud/core";

const DEMO_XML = `<PathOfBuilding>
  <Build className="Witch" ascendClassName="Elementalist" bandit="Alira" level="42" buildName="League Start RF Elementalist"/>
  <Skills>
    <SkillSet id="1" title="Act 1 (Lv 1-12)">
      <Skill enabled="true" label="Starter Clear">
        <Gem enabled="true" nameSpec="Rolling Magma" gemId="Metadata/Items/Gems/SkillGemMagmaOrb"/>
        <Gem enabled="true" nameSpec="Elemental Proliferation Support" gemId="Metadata/Items/Gems/SupportGemElementalProliferation"/>
        <Gem enabled="true" nameSpec="Arcane Surge Support" gemId="Metadata/Items/Gems/SupportGemArcaneSurge"/>
      </Skill>
      <Skill enabled="true" label="Auras">
        <Gem enabled="true" nameSpec="Purity of Elements" gemId="Metadata/Items/Gems/SkillGemPurityOfElements"/>
      </Skill>
    </SkillSet>
    <SkillSet id="2" title="Act 3 Transition (Lv 24)">
      <Skill enabled="true" label="Main RF">
        <Gem enabled="true" nameSpec="Righteous Fire" gemId="Metadata/Items/Gems/SkillGemRighteousFire"/>
        <Gem enabled="true" nameSpec="Elemental Focus Support" gemId="Metadata/Items/Gems/SupportGemElementalFocus"/>
        <Gem enabled="true" nameSpec="Burning Damage Support" gemId="Metadata/Items/Gems/SupportGemBurningDamage"/>
      </Skill>
      <Skill enabled="true" label="Fire Trap &amp; Auras">
        <Gem enabled="true" nameSpec="Fire Trap" gemId="Metadata/Items/Gems/SkillGemFireTrap"/>
        <Gem enabled="true" nameSpec="Purity of Elements" gemId="Metadata/Items/Gems/SkillGemPurityOfElements"/>
        <Gem enabled="true" nameSpec="Determination" gemId="Metadata/Items/Gems/SkillGemDetermination"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="2">
    <Spec title="Act 1 (Lv 1-12)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,57226,21678,32210,8948,27929"/>
    <Spec title="Act 3 Transition (Lv 28)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,16023,12738,53123"/>
    <Spec title="Cruel Lab (Lv 55)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,16023,12738,53123,37114,61259"/>
    <Spec title="Merciless Lab (Lv 68)" treeVersion="3_30" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,16023,12738,53123,37114,61259,19595,57197"/>
    <Spec title="Endgame (Lv 75)" treeVersion="3_30" masteryEffects="{34927,24180}" nodes="54447,57264,37569,36542,4397,11420,7938,1031,33755,21958,14021,55332,22088,14936,44184,61804,14040,18715,10893,60501,34927,16023,12738,53123,37114,61259,19595,57197,6052,4917"/>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: MAGIC
+1 Fire Driftwood Wand
Driftwood Wand
Sockets: B-B-G
LevelReq: 1
Implicits: 0
+12% increased Fire Damage
    </Item>
    <Item id="2">
Rarity: UNIQUE
Goldrim
Leather Cap
Sockets: R-B-B
LevelReq: 1
Implicits: 0
+38% to all Elemental Resistances
    </Item>
    <Item id="3">
Rarity: RARE
Brimstone Sceptre
Karui Sceptre
Sockets: B-B-R
LevelReq: 24
Implicits: 0
+1 to Level of all Fire Spell Skill Gems
28% increased Elemental Damage
    </Item>
    <Item id="4">
Rarity: UNIQUE
Tabula Rasa
Simple Robe
Sockets: W-W-W-W-W-W
LevelReq: 1
Implicits: 0
6-Link White Sockets
    </Item>
    <Item id="5">
Rarity: RARE
Storm Fist
Silk Gloves
Sockets: B-B-G
LevelReq: 20
Implicits: 0
+42 to maximum Life
+24% to Fire Resistance
+18% to Cold Resistance
    </Item>
    <Item id="6">
Rarity: RARE
Gale Stride
Mesh Boots
Sockets: R-G-B
LevelReq: 22
Implicits: 0
+36 to maximum Life
+22% to Cold Resistance
    </Item>
    <Item id="7">
Rarity: MAGIC
Bubbling Greater Life Flask
Greater Life Flask
LevelReq: 12
Implicits: 0
50% of Recovery applied Instantly
Immunity to Bleeding for 4 seconds
    </Item>
    <Item id="8">
Rarity: MAGIC
Experimenter's Quicksilver Flask
Quicksilver Flask
LevelReq: 4
Implicits: 0
40% increased Movement Speed
32% increased Duration
    </Item>
    <ItemSet id="1" title="Act 1 Starter">
      <Slot name="Weapon 1" itemId="1"/>
      <Slot name="Helmet" itemId="2"/>
      <Slot name="Body Armour" itemId="4"/>
      <Slot name="Flask 1" itemId="7"/>
      <Slot name="Flask 2" itemId="8"/>
    </ItemSet>
    <ItemSet id="2" title="Act 3 Transition (Lv 24)">
      <Slot name="Weapon 1" itemId="3"/>
      <Slot name="Helmet" itemId="2"/>
      <Slot name="Body Armour" itemId="4"/>
      <Slot name="Gloves" itemId="5"/>
      <Slot name="Boots" itemId="6"/>
      <Slot name="Flask 1" itemId="7"/>
      <Slot name="Flask 2" itemId="8"/>
    </ItemSet>
  </Items>
</PathOfBuilding>`;

export function createInteractiveDemoSnapshot(): HudSessionSnapshot {
  const parsed = parsePobXmlString(DEMO_XML);
  const extracted = extractPobBuild(parsed, poe1GameAdapter);
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "Alira", includeLibrary: false });
  const rawRoute = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(rawRoute, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(
    { ...extracted, isEndgameOnlyFallback: false, fallbackNotice: null, requiresAct3Library: false },
    routeSteps,
    poe1GameAdapter,
  );

  let snap = buildInitialSessionSnapshot({
    roomId: "DEMO01",
    profileId: "demo-rf",
    build: { ...extracted, isEndgameOnlyFallback: false, fallbackNotice: null, requiresAct3Library: false },
    checkpoints,
    gemSteps,
    adapter: poe1GameAdapter,
    characterName: "ExileRunner",
  });

  snap = reduceTelemetrySession(snap, { type: "process_state", running: true }, poe1GameAdapter);
  const coastEvent = parseClientLogLine('2026/11/13 [INFO Client 1] Generating level 2 area "1_1_2" with seed 12345')!;
  snap = reduceTelemetrySession(snap, { type: "client_log", event: coastEvent, autoDetectCharacter: true }, poe1GameAdapter);
  const passiveTree = computePassiveTreeDiff({
    treeSpecs: extracted.treeSpecs,
    allocatedHashes: [54447, 57264, 37569, 36542, 4397, 11420, 57226, 21678],
    characterLevel: 30,
    adapter: poe1GameAdapter,
  });

  const activeSkillSet = selectActiveSkillSet(snap.skillSets ?? [], 30);

  return {
    ...snap,
    linkGroups: activeSkillSet?.groups ?? snap.linkGroups,
    passiveTree,
    characterLevel: 30,
    equippedItemNames: ["goldrim"],
    characterSyncStatus: "ONLINE_PUBLIC",
    runElapsedMs: 142_000,
    runTimerRunning: true,
    resistances: {
      source: "API_VERIFIED",
      kitavaPenalty: 0,
      fire: { actual: 28, target: 35 },
      cold: { actual: 46, target: 50 },
      lightning: { actual: 18, target: 35 },
      chaos: { actual: 0, target: 0 },
      upcomingBossWarning: "Merveil Heavy Cold projectiles — Sapphire Ring recommended",
    },
    gearHygiene: [
      { id: "demo_ms", severity: "info", slot: "boots", message: "Check Nessa / Tarkleigh for +10% Movement Speed boots" },
    ],
    benchCraftSuggestions: [
      {
        id: "bench_res_lightning_Gloves",
        priority: "high",
        problemSummary: "Lightning Res -17% under cap",
        prescription: "Craft 16-20% Lightning Res on Gloves (1x Orb of Transmutation)",
        slot: "Gloves",
        recipeId: "HelenaMasterLightningResist1",
        recipeLabel: "16-20% Lightning Res",
        costLabel: "1x Orb of Transmutation",
        affixType: "suffix",
      },
      {
        id: "bench_res_fire_Boots",
        priority: "high",
        problemSummary: "Fire Res -7% under cap",
        prescription: "Craft 16-20% Fire Res on Boots (1x Orb of Transmutation)",
        slot: "Boots",
        recipeId: "HelenaMasterFireResist1",
        recipeLabel: "16-20% Fire Res",
        costLabel: "1x Orb of Transmutation",
        affixType: "suffix",
      },
    ],
  };
}
