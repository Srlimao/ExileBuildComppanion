import {
  computePassiveTreeDiff,
  parseClientLogLine,
  reduceTelemetrySession,
  selectActiveSkillSet,
  selectActiveTreeSpec,
  verifySocketsAndGems,
  type GggItemModRecord,
  type HudSessionSnapshot,
  type TargetItemSetSummary,
  type ValidatedPobBuild,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  checkPoeRunning,
  detectClientLogPath,
  hasPoesessid,
  isTauriRuntime,
  readBootstrapLogLines,
  setClientLogPath,
} from "./tauri_ipc_adapter.js";

export function applyLogLinesToSnapshot(cur: HudSessionSnapshot, lines: string[]): HudSessionSnapshot {
  let next = cur;
  for (const raw of lines) {
    const parsed = parseClientLogLine(raw);
    if (!parsed) continue;
    next = reduceTelemetrySession(next, { type: "client_log", event: parsed, autoDetectCharacter: true }, poe1GameAdapter);
  }
  return next;
}

export async function hookAndBootstrapLogPath(
  path: string,
  manual: boolean,
  cur: HudSessionSnapshot | null,
): Promise<{ hooked: boolean; nextSnapshot: HudSessionSnapshot | null }> {
  const hooked = await setClientLogPath(path, manual);
  let nextSnapshot = cur ? { ...cur, clientLogHooked: hooked } : null;
  if (hooked) {
    const bootLines = await readBootstrapLogLines();
    if (nextSnapshot && bootLines.length > 0) {
      nextSnapshot = applyLogLinesToSnapshot(nextSnapshot, bootLines);
    }
  }
  return { hooked, nextSnapshot };
}

export async function bootstrapHostEnvironment(initialSnap: HudSessionSnapshot): Promise<{
  detectedPath: string | null;
  hooked: boolean;
  hasSession: boolean;
  snapshot: HudSessionSnapshot;
}> {
  let snap = initialSnap;
  const [logRes, hasSession, poeLive] = await Promise.all([
    detectClientLogPath(),
    hasPoesessid(),
    checkPoeRunning(),
  ]);

  if (isTauriRuntime()) {
    snap = reduceTelemetrySession(snap, { type: "process_state", running: poeLive }, poe1GameAdapter);
  }

  let hooked = false;
  if (logRes.detectedPath) {
    const result = await hookAndBootstrapLogPath(logRes.detectedPath, false, snap);
    hooked = result.hooked;
    if (result.nextSnapshot) snap = result.nextSnapshot;
  }

  return {
    detectedPath: logRes.detectedPath,
    hooked,
    hasSession,
    snapshot: snap,
  };
}

/** Updates active passive spec and skill link groups whenever character level crosses a breakpoint. */
export function syncBuildSetsForLevel(
  snapshot: HudSessionSnapshot,
  build: ValidatedPobBuild | null,
): HudSessionSnapshot {
  if (!build) return snapshot;
  let next = snapshot;

  const activeSpec = selectActiveTreeSpec(build.treeSpecs, snapshot.characterLevel);
  if (activeSpec && activeSpec.title !== snapshot.passiveTree.specName) {
    next = {
      ...next,
      passiveTree: computePassiveTreeDiff({
        treeSpecs: build.treeSpecs,
        allocatedHashes: [],
        characterLevel: snapshot.characterLevel,
        adapter: poe1GameAdapter,
      }),
    };
  }

  const activeSet = selectActiveSkillSet(build.skillSets, snapshot.characterLevel);
  if (activeSet && snapshot.linkGroups[0]?.minLevel !== activeSet.minLevel) {
    const prevVerified = new Map(snapshot.gemSteps.map((s) => [s.id, s.verifiedByApi]));
    const verified = verifySocketsAndGems({
      items: [],
      skillSets: build.skillSets,
      gemSteps: snapshot.gemSteps,
      characterLevel: snapshot.characterLevel,
    });
    next = {
      ...next,
      gemSteps: verified.updatedGemSteps.map((s) => ({
        ...s,
        verifiedByApi: prevVerified.get(s.id) ?? false,
      })),
      linkGroups: verified.linkGroups,
    };
  }

  return next;
}

/** Marks imported PoB ItemSet slots whose item name or base type matches equipped GGG API gear. */
export function markEquippedItemSets(
  itemSets: TargetItemSetSummary[],
  items: GggItemModRecord[],
): TargetItemSetSummary[] {
  const equippedTokens = new Set<string>();
  for (const item of items) {
    if (item.inventoryId === "MainInventory") continue;
    for (const candidate of [item.name, item.baseType, item.typeLine]) {
      const normalized = candidate?.trim().toLowerCase();
      if (normalized) equippedTokens.add(normalized);
    }
  }
  return itemSets.map((set) => ({
    ...set,
    slots: set.slots.map((slot) => ({
      ...slot,
      verifiedEquipped:
        equippedTokens.has(slot.itemName.toLowerCase()) ||
        equippedTokens.has(slot.baseType.toLowerCase()),
    })),
  }));
}
