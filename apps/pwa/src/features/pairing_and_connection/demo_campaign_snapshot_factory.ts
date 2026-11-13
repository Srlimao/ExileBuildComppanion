import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  extractPobBuild,
  parseClientLogLine,
  parsePobXmlString,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  type HudSessionSnapshot,
} from "@exile-hud/core";

const DEMO_XML = `<PathOfBuilding>
  <Build className="Witch" ascendClassName="Elementalist" bandit="Alira" level="42" buildName="League Start RF Elementalist"/>
  <Skills>
    <SkillSet title="Act 1 (Lv 1-12)">
      <Skill enabled="true" label="Starter Clear">
        <Gem enabled="true" nameSpec="Rolling Magma" gemId="Metadata/Items/Gems/SkillGemMagmaOrb"/>
        <Gem enabled="true" nameSpec="Elemental Proliferation Support" gemId="Metadata/Items/Gems/SupportGemElementalProliferation"/>
        <Gem enabled="true" nameSpec="Arcane Surge Support" gemId="Metadata/Items/Gems/SupportGemArcaneSurge"/>
      </Skill>
      <Skill enabled="true" label="Auras">
        <Gem enabled="true" nameSpec="Purity of Elements" gemId="Metadata/Items/Gems/SkillGemPurityOfElements"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec title="Campaign" treeVersion="3_29" nodes="26725,44103,14993,57226"/></Tree>
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

  return {
    ...snap,
    characterLevel: 3,
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
  };
}
