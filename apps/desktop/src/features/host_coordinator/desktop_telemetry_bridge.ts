import {
  assignGemsToCampaignRoute,
  auditGearAndFlaskHygiene,
  buildCheckpointGraph,
  buildInitialSessionSnapshot,
  buildPreprocessorDefinitions,
  buildVendorSearchRegex,
  combineRouteActFiles,
  computePassiveTreeDiff,
  estimateEquippedResistances,
  extractPobBuild,
  parsePoelabDailyJson,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
  reduceTelemetrySession,
  resolveAndDecodePobInput,
  validateAndEnrichPobBuild,
  verifySocketsAndGems,
  type GggItemModRecord,
  type HudSessionSnapshot,
  type ValidatedPobBuild,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import type { CharacterPollResponse } from "./tauri_ipc_adapter.js";

export const DEFAULT_STARTER_POB_XML = `<PathOfBuilding>
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

export interface CompiledProfileBundle {
  build: ValidatedPobBuild;
  snapshot: HudSessionSnapshot;
}

export async function compilePobProfileToSnapshot(params: {
  roomId: string;
  profileId: string;
  rawPobInput: string;
  customRouteText?: string;
  leagueStart: boolean;
  characterName?: string;
  previousSnapshot?: HudSessionSnapshot | null;
}): Promise<CompiledProfileBundle> {
  const decoded = await resolveAndDecodePobInput(params.rawPobInput);
  const extracted = extractPobBuild(decoded.parsedXml, poe1GameAdapter);
  const build = validateAndEnrichPobBuild(extracted, poe1GameAdapter);

  const defs = buildPreprocessorDefinitions({
    leagueStart: params.leagueStart,
    bandit: build.bandit,
    includeLibrary: build.requiresAct3Library,
  });
  const combinedRoute = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles(), params.customRouteText);
  const routeSteps = parsePreprocessedRouteLines(preprocessRouteConditionals(combinedRoute, defs), poe1GameAdapter);
  const checkpoints = buildCheckpointGraph(routeSteps, poe1GameAdapter);
  const gemSteps = assignGemsToCampaignRoute(build, routeSteps, poe1GameAdapter);

  const fresh = buildInitialSessionSnapshot({
    roomId: params.roomId,
    profileId: params.profileId,
    build,
    checkpoints,
    gemSteps,
    adapter: poe1GameAdapter,
    characterName: params.characterName || params.previousSnapshot?.characterName,
  });

  if (!params.previousSnapshot) {
    return { build, snapshot: { ...fresh, leagueStart: params.leagueStart } };
  }

  return {
    build,
    snapshot: {
      ...fresh,
      leagueStart: params.leagueStart,
      poeRunning: params.previousSnapshot.poeRunning,
      clientLogHooked: params.previousSnapshot.clientLogHooked,
      autoClipboardEnabled: params.previousSnapshot.autoClipboardEnabled,
      currentAreaId: params.previousSnapshot.currentAreaId,
      currentAreaName: params.previousSnapshot.currentAreaName,
      currentAreaLevel: params.previousSnapshot.currentAreaLevel,
      currentAct: params.previousSnapshot.currentAct,
      highestUnlockedAct: params.previousSnapshot.highestUnlockedAct,
      mode: params.previousSnapshot.mode,
    },
  };
}

export function applyGggCharacterResponseToSnapshot(
  snapshot: HudSessionSnapshot,
  build: ValidatedPobBuild,
  response: CharacterPollResponse,
): HudSessionSnapshot {
  if (!response.ok || !response.itemsJson) {
    return {
      ...snapshot,
      version: snapshot.version + 1,
      characterSyncStatus: "OFFLINE_FALLBACK",
    };
  }

  const items = (Array.isArray(response.itemsJson.items) ? response.itemsJson.items : []) as GggItemModRecord[];
  const charMeta = response.itemsJson.character as { level?: number; name?: string } | undefined;
  const characterLevel = typeof charMeta?.level === "number" ? charMeta.level : snapshot.characterLevel;
  const allocatedHashes = Array.isArray(response.passivesJson?.hashes)
    ? (response.passivesJson.hashes as number[])
    : [];

  const completedBossFlags: string[] = [];
  if (snapshot.highestUnlockedAct >= 6) completedBossFlags.push("kitava_act5");
  if (snapshot.highestUnlockedAct >= 11) completedBossFlags.push("kitava_act10");

  const resistances = estimateEquippedResistances({
    items,
    allocatedNodeIds: allocatedHashes,
    bandit: build.bandit,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    completedBossFlags,
    adapter: poe1GameAdapter,
  });

  const gemVerification = verifySocketsAndGems({
    items,
    skillSets: build.skillSets,
    gemSteps: snapshot.gemSteps,
    characterLevel,
  });

  const passiveTree = computePassiveTreeDiff({
    treeSpecs: build.treeSpecs,
    allocatedHashes,
    characterLevel,
    adapter: poe1GameAdapter,
  });

  const gearHygiene = auditGearAndFlaskHygiene({
    items,
    characterLevel,
    highestUnlockedAct: snapshot.highestUnlockedAct,
    isAttackBuild: build.characterClass === "Ranger" || build.characterClass === "Duelist",
  });

  const activeVendorRegex = buildVendorSearchRegex({
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    currentAct: snapshot.currentAct,
  });

  return {
    ...snapshot,
    version: snapshot.version + 1,
    characterName: charMeta?.name || snapshot.characterName,
    characterLevel,
    characterSyncStatus: response.usedPoesessid ? "ONLINE_POESESSID" : "ONLINE_PUBLIC",
    lastCharacterSyncAt: Date.now(),
    gemSteps: gemVerification.updatedGemSteps,
    linkGroups: gemVerification.linkGroups,
    resistances,
    gearHygiene,
    passiveTree,
    activeVendorRegex,
  };
}

export function deriveTrayIndicator(snapshot: HudSessionSnapshot, relayConnected: boolean): {
  status: "gray" | "green" | "amber";
  tooltip: string;
} {
  if (!snapshot.poeRunning) {
    return { status: "gray", tooltip: "Exile Companion HUD — PoE Standby" };
  }
  if (!relayConnected || snapshot.characterSyncStatus === "OFFLINE_FALLBACK") {
    return {
      status: "amber",
      tooltip: `Exile Companion HUD — Degraded (${relayConnected ? "API Fallback" : "Relay Disconnected"})`,
    };
  }
  return {
    status: "green",
    tooltip: `Exile Companion HUD — Live (${snapshot.currentAreaName})`,
  };
}

export function applyViewerCommandToSnapshot(
  cur: HudSessionSnapshot,
  cmd: ViewerToRoomMessage,
): { nextSnapshot?: HudSessionSnapshot; eventTag?: string; copyRegex?: string } {
  if (cmd.type === "viewer:toggle_checkpoint") {
    return {
      nextSnapshot: reduceTelemetrySession(
        cur,
        { type: "toggle_checkpoint", checkpointId: cmd.checkpointId, completed: cmd.completed },
        poe1GameAdapter,
      ),
      eventTag: "viewer_checkpoint",
    };
  }
  if (cmd.type === "viewer:toggle_gem") {
    return {
      nextSnapshot: reduceTelemetrySession(
        cur,
        { type: "toggle_gem", gemStepId: cmd.gemStepId, completed: cmd.completed },
        poe1GameAdapter,
      ),
      eventTag: "viewer_gem",
    };
  }
  if (cmd.type === "viewer:request_regex_copy") {
    return { copyRegex: cmd.regex ?? cur.activeVendorRegex };
  }
  if (cmd.type === "viewer:import_poelab_daily") {
    const lab = parsePoelabDailyJson(cmd.rawJson);
    return {
      nextSnapshot: { ...cur, version: cur.version + 1, lab },
      eventTag: "poelab_import",
    };
  }
  return {};
}

