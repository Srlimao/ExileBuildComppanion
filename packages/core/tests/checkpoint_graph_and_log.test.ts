import { describe, expect, it } from "vitest";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  disambiguateZoneByName,
  extractPobBuild,
  parseClientLogLine,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
} from "../src/index.js";

const SAMPLE_XML = `<PathOfBuilding>
  <Build className="Witch" ascendClassName="None" bandit="None" level="20" buildName="Test Witch"/>
  <Skills>
    <SkillSet title="Act 1">
      <Skill enabled="true">
        <Gem enabled="true" nameSpec="Frostblink" gemId="Metadata/Items/Gems/SkillGemFrostblink"/>
        <Gem enabled="true" nameSpec="Summon Phantasm Support" gemId="Metadata/Items/Gems/SupportGemSummonPhantasm"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree><Spec title="Tree" treeVersion="3_29" nodes="26725"/></Tree>
</PathOfBuilding>`;

async function createTestSnapshot() {
  const doc = await resolveAndDecodePobInput(SAMPLE_XML);
  const build = validateAndEnrichPobBuild(extractPobBuild(doc.parsedXml, poe1GameAdapter), poe1GameAdapter);
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary: false });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, poe1GameAdapter);
  return buildInitialSessionSnapshot({ roomId: "ROOM1", profileId: "prof1", build, checkpoints, gemSteps, adapter: poe1GameAdapter });
}

describe("Checkpoint Graph, Zone Disambiguator & Progression Reducer", () => {
  it("parses deterministic Generating level areaId and disambiguates Part 1 vs Part 2 Coast", () => {
    const gen = parseClientLogLine(
      '2026/11/13 18:00:00 1000 [INFO Client 123] Generating level 56 area "2_6_2" with seed 987654321',
    );
    expect(gen).toEqual({ type: "area_generated", areaLevel: 56, areaId: "2_6_2", areaSeed: "987654321" });

    const part1Coast = disambiguateZoneByName(
      "The Coast",
      { highestUnlockedAct: 1, lastCombatZoneId: "1_1_1", characterLevel: 3 },
      poe1GameAdapter,
    );
    const part2Coast = disambiguateZoneByName(
      "The Coast",
      { highestUnlockedAct: 6, lastCombatZoneId: "2_6_town", characterLevel: 47 },
      poe1GameAdapter,
    );
    expect(part1Coast?.id).toBe("1_1_2");
    expect(part2Coast?.id).toBe("2_6_2");
  });

  it("handles party carry upstream completion, death respawn banner, soft-tracking, and standby mode", async () => {
    let state = await createTestSnapshot();
    state = reduceTelemetrySession(state, { type: "process_state", running: true }, poe1GameAdapter);

    // Jump straight into Act 1 Town, then Mud Flats (party portal carry past Coast)
    const townEvent = parseClientLogLine('2026/11/13 [INFO Client 1] Generating level 1 area "1_1_town" with seed 11')!;
    state = reduceTelemetrySession(state, { type: "client_log", event: townEvent, autoDetectCharacter: true }, poe1GameAdapter);
    expect(state.mode).toBe("TOWN");

    const mudEvent = parseClientLogLine('2026/11/13 [INFO Client 1] Generating level 4 area "1_1_3" with seed 22')!;
    state = reduceTelemetrySession(state, { type: "client_log", event: mudEvent, autoDetectCharacter: true }, poe1GameAdapter);
    expect(state.mode).toBe("FIELD");
    expect(state.gemSteps.some((g) => g.act === 1 && g.softAcquired)).toBe(true); // API offline soft-tracking
    expect(state.checkpoints[0]?.completed).toBe(true); // Upstream Hillock / Lioneye's Watch implicitly completed

    // Player dies in Mud Flats and respawns in Lioneye's Watch
    const slain = parseClientLogLine("2026/11/13 [INFO Client 1] : TestWitch has been slain.")!;
    state = reduceTelemetrySession(state, { type: "client_log", event: slain, autoDetectCharacter: true }, poe1GameAdapter);
    state = reduceTelemetrySession(state, { type: "client_log", event: townEvent, autoDetectCharacter: true }, poe1GameAdapter);
    expect(state.mode).toBe("TOWN");
    expect(state.resumeZoneBanner).toEqual({ areaId: "1_1_3", areaName: "The Mud Flats" });

    // Skill point quest log auto-completes first SKILL_BOOK
    const sp = parseClientLogLine("2026/11/13 [INFO Client 1] : You have received 1 passive skill point.")!;
    state = reduceTelemetrySession(state, { type: "client_log", event: sp, autoDetectCharacter: true }, poe1GameAdapter);
    expect(state.checkpoints.some((c) => c.category === "SKILL_BOOK" && c.completed)).toBe(true);

    // Closing PoE switches HUD to STANDBY and pauses timer
    state = reduceTelemetrySession(state, { type: "process_state", running: false }, poe1GameAdapter);
    expect(state.mode).toBe("STANDBY");
    expect(state.runTimerRunning).toBe(false);
  });
});
