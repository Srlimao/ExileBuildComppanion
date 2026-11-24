import { getGameAdapter } from "@exile-hud/game-data";
import { describe, expect, it } from "vitest";
import {
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  extractPobBuild,
  parseClientLogLine,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
} from "../src/index.js";

const MINI_POE2_XML = `<PathOfBuilding2>
  <Build className="Monk" ascendClassName="Invoker" bandit="None" level="65" buildName="Poe2 Campaign Runner"/>
  <Skills activeSkillSet="1">
    <SkillSet id="1" title="Act 1-7">
      <Skill enabled="true" label="Core">
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemIceStrike" nameSpec="Ice Strike" level="18"/>
        <Gem enabled="true" gemId="Metadata/Items/Gems/SkillGemHeraldOfIce" nameSpec="Herald of Ice" level="18"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec id="1" title="Campaign" treeVersion="poe2_0_4" nodes="101"/></Tree>
</PathOfBuilding2>`;

async function buildPoe2InitialState() {
  const adapter = getGameAdapter("poe2");
  const decoded = await resolveAndDecodePobInput(MINI_POE2_XML);
  const extracted = extractPobBuild(decoded.parsedXml, adapter);
  const build = validateAndEnrichPobBuild(extracted, adapter);
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: false });
  const combined = combineRouteActFiles(adapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(combined, defs), adapter);
  const checkpoints = buildCheckpointGraph(routeSteps, adapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, adapter);
  const snapshot = buildInitialSessionSnapshot({
    roomId: "POE2RM",
    profileId: "poe2-prof",
    build,
    checkpoints,
    gemSteps,
    adapter,
    characterName: "FrostMonk",
  });
  return { adapter, snapshot: reduceTelemetrySession(snapshot, { type: "process_state", running: true }, adapter) };
}

describe("poe2_campaign_progression", () => {
  it("compiles all 7 PoE 2 campaign stages (Acts 1-4 + Interludes 1-3) against real areas.json entries", async () => {
    const { adapter, snapshot } = await buildPoe2InitialState();
    const areas = adapter.getAreas();
    const sectionActs = new Set(snapshot.checkpoints.map((c) => c.sectionAct));
    expect([...sectionActs].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(snapshot.checkpoints.every((cp) => Boolean(areas[cp.areaId]))).toBe(true);
    expect(snapshot.currentAreaId).toBe("G1_1");
    expect(snapshot.currentAreaName).toBe("The Riverbank");
    expect(snapshot.poe2SpiritSummary).toEqual({
      requiredSpirit: 30,
      unlockedSpirit: 0,
      campaignGuaranteedSpirit: 100,
    });
  });

  it("tracks DEBUG/INFO Client.txt transitions, Sekhemas/Chaos LAB mode, resistance penalties, Spirit & Runes", async () => {
    const { adapter, snapshot } = await buildPoe2InitialState();
    let state = snapshot;

    const replay = (rawLine: string) => {
      const event = parseClientLogLine(rawLine);
      expect(event).not.toBeNull();
      state = reduceTelemetrySession(state, { type: "client_log", event: event!, autoDetectCharacter: true }, adapter);
    };

    replay('2026/11/24 00:00:00 100 [DEBUG Client 1234] Generating level 1 area "G1_town" with seed 1');
    expect(state.mode).toBe("TOWN");
    expect(state.currentAreaName).toBe("Clearfell Encampment");

    replay('2026/11/24 00:01:00 100 [DEBUG Client 1234] Generating level 11 area "G1_12" with seed 22');
    replay('2026/11/24 00:02:00 100 [DEBUG Client 1234] Generating level 16 area "G2_1" with seed 33');
    expect(state.highestUnlockedAct).toBe(2);
    expect(state.resistances.kitavaPenalty).toBe(-10);
    expect(state.poe2SpiritSummary?.unlockedSpirit).toBe(30);
    expect(state.permanentBonuses?.find((b) => b.id === "poe2_a1_king_mists")?.completed).toBe(true);

    replay('2026/11/24 00:03:00 100 [DEBUG Client 1234] Generating level 22 area "Sanctum_1" with seed 44');
    expect(state.mode).toBe("LAB");

    replay('2026/11/24 00:04:00 100 [DEBUG Client 1234] Generating level 38 area "G3_10" with seed 55');
    expect(state.mode).toBe("LAB");
    expect(state.resistances.kitavaPenalty).toBe(-20);

    replay('2026/11/24 00:05:00 100 [INFO Client 1234] : You have entered The Refuge.');
    expect(state.currentAreaId).toBe("P1_Town");
    expect(state.currentAct).toBe(5);
    expect(state.mode).toBe("TOWN");
    expect(state.resistances.kitavaPenalty).toBe(-40);

    replay('2026/11/24 00:06:00 100 [DEBUG Client 1234] Generating level 54 area "P3_2" with seed 66');
    replay('2026/11/24 00:07:00 100 [DEBUG Client 1234] Generating level 55 area "P3_3" with seed 77');
    expect(state.currentAct).toBe(7);
    expect(state.resistances.kitavaPenalty).toBe(-50);
    expect(state.poe2SpiritSummary?.unlockedSpirit).toBe(70);
    expect(state.runeSuggestions?.length).toBeGreaterThan(0);
    expect(state.runeSuggestions?.some((r) => /Rune|Soul Core/i.test(r.runeName))).toBe(true);

    replay('2026/11/24 00:08:00 100 [DEBUG Client 1234] Generating level 65 area "G_Endgame_Town" with seed 88');
    expect(state.highestUnlockedAct).toBe(8);
    expect(state.resistances.kitavaPenalty).toBe(-60);
    expect(state.mode).toBe("TOWN");
  });
});
