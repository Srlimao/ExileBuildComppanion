import { describe, expect, it } from "vitest";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  applySavedCampaignProgress,
  assignGemsToCampaignRoute,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  countCompletedProgress,
  createEmptyCampaignProgress,
  extractCampaignProgress,
  extractPobBuild,
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

async function buildSnapshot(includeLibrary: boolean) {
  const doc = await resolveAndDecodePobInput(SAMPLE_XML);
  const build = validateAndEnrichPobBuild(extractPobBuild(doc.parsedXml, poe1GameAdapter), poe1GameAdapter);
  const defs = buildPreprocessorDefinitions({ leagueStart: true, bandit: "None", includeLibrary });
  const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(raw, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, poe1GameAdapter);
  return buildInitialSessionSnapshot({
    roomId: "ROOM1",
    profileId: "prof1",
    build,
    checkpoints,
    gemSteps,
    adapter: poe1GameAdapter,
  });
}

describe("Campaign Progress Persistence", () => {
  it("extracts and re-applies completed checkpoints and gems even across route conditional changes", async () => {
    let snap = await buildSnapshot(false);
    const act1Step = snap.checkpoints.find((cp) => cp.sectionAct === 1)!;
    const act4Step = snap.checkpoints.find((cp) => cp.sectionAct === 4)!;
    const gemStep = snap.gemSteps[0]!;

    snap = reduceTelemetrySession(snap, { type: "toggle_checkpoint", checkpointId: act1Step.id }, poe1GameAdapter);
    snap = reduceTelemetrySession(snap, { type: "toggle_checkpoint", checkpointId: act4Step.id }, poe1GameAdapter);
    snap = reduceTelemetrySession(snap, { type: "toggle_gem", gemStepId: gemStep.id }, poe1GameAdapter);

    const saved = extractCampaignProgress(snap, { nowMs: 12345 });
    expect(saved.wasExplicitlyReset).toBe(false);
    expect(saved.manualCompletedGemIds).toContain(gemStep.id);

    // Recompile with includeLibrary=true (shifts Act 4 numerical step indices/IDs)
    const recompiled = await buildSnapshot(true);
    const restored = applySavedCampaignProgress(recompiled, saved);
    const restoredAct1 = restored.checkpoints.find((cp) => cp.sectionAct === 1 && cp.title === act1Step.title);
    const restoredAct4 = restored.checkpoints.find((cp) => cp.sectionAct === 4 && cp.title === act4Step.title);
    const restoredGem = restored.gemSteps.find((g) => g.id === gemStep.id);

    expect(restoredAct1?.completed).toBe(true);
    expect(restoredAct4?.completed).toBe(true);
    expect(restoredGem?.manualCompleted).toBe(true);
    expect(countCompletedProgress(restored)).toMatchObject({
      completedCheckpoints: 2,
      completedGems: 1,
      hasAnyProgress: true,
    });
  });

  it("honors wasExplicitlyReset to clear stale bootstrapped mandatory checkpoints on reload", async () => {
    let bootstrapped = await buildSnapshot(false);
    bootstrapped = reduceTelemetrySession(
      bootstrapped,
      { type: "toggle_checkpoint", checkpointId: bootstrapped.checkpoints[0]!.id, completed: true },
      poe1GameAdapter,
    );
    expect(countCompletedProgress(bootstrapped).hasAnyProgress).toBe(true);

    const cleared = applySavedCampaignProgress(bootstrapped, createEmptyCampaignProgress(999));
    expect(countCompletedProgress(cleared)).toMatchObject({
      completedCheckpoints: 0,
      completedGems: 0,
      hasAnyProgress: false,
    });
  });

  it("clears softAcquired when toggling a gem off and resets all progress on reset_progress", async () => {
    let snap = await buildSnapshot(false);
    const firstGem = snap.gemSteps[0]!;
    snap = {
      ...snap,
      gemSteps: snap.gemSteps.map((g, i) => (i === 0 ? { ...g, softAcquired: true } : g)),
    };

    const toggledOff = reduceTelemetrySession(snap, { type: "toggle_gem", gemStepId: firstGem.id }, poe1GameAdapter);
    expect(toggledOff.gemSteps[0]?.manualCompleted).toBe(false);
    expect(toggledOff.gemSteps[0]?.softAcquired).toBe(false);

    let dirty = reduceTelemetrySession(
      toggledOff,
      { type: "toggle_checkpoint", checkpointId: toggledOff.checkpoints[0]!.id, completed: true },
      poe1GameAdapter,
    );
    dirty = reduceTelemetrySession(dirty, { type: "toggle_gem", gemStepId: firstGem.id, completed: true }, poe1GameAdapter);
    dirty = { ...dirty, lab: { ...dirty.lab, completedTrialAreaIds: ["1_1_7_2"] } };

    const reset = reduceTelemetrySession(dirty, { type: "reset_progress" }, poe1GameAdapter);
    expect(countCompletedProgress(reset)).toMatchObject({
      completedCheckpoints: 0,
      completedGems: 0,
      hasAnyProgress: false,
    });
    expect(reset.lab.completedTrialAreaIds).toEqual([]);
    expect(reset.nextTownCurrencyBudget.wisdom + reset.nextTownCurrencyBudget.transmutation).toBeGreaterThanOrEqual(
      dirty.nextTownCurrencyBudget.wisdom + dirty.nextTownCurrencyBudget.transmutation,
    );
    expect(reset.activeVendorRegex).toContain("nne");
  });
});
