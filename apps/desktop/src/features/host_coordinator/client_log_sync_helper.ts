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
import { getGameAdapter } from "@exile-hud/game-data";
import {
  checkPoeRunning,
  detectClientLogPath,
  isTauriRuntime,
  readBootstrapLogLines,
  setActiveGameModeIpc,
  setClientLogPath,
} from "./tauri_ipc_adapter.js";

export function applyLogLinesToSnapshot(cur: HudSessionSnapshot, lines: string[]): HudSessionSnapshot {
  let next = cur;
  const adapter = getGameAdapter(cur.gameId);
  for (const raw of lines) {
    const parsed = parseClientLogLine(raw);
    if (!parsed) continue;
    next = reduceTelemetrySession(next, { type: "client_log", event: parsed, autoDetectCharacter: true }, adapter);
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

export async function bootstrapHostEnvironment(
  initialSnap: HudSessionSnapshot,
  options?: { savedLogPath?: string | null },
): Promise<{
  detectedPath: string | null;
  hooked: boolean;
  snapshot: HudSessionSnapshot;
}> {
  let snap = initialSnap;
  const adapter = getGameAdapter(snap.gameId);
  const savedLog = options?.savedLogPath?.trim() || null;

  const [logRes, poeLive] = isTauriRuntime()
    ? await Promise.all([
        setActiveGameModeIpc(adapter.gameId, savedLog, Boolean(savedLog)),
        checkPoeRunning(adapter.gameId),
      ])
    : await Promise.all([detectClientLogPath(adapter.gameId), checkPoeRunning(adapter.gameId)]);

  if (isTauriRuntime()) {
    snap = reduceTelemetrySession(snap, { type: "process_state", running: poeLive }, adapter);
  }

  let hooked = false;
  if (logRes.detectedPath) {
    const result = await hookAndBootstrapLogPath(logRes.detectedPath, Boolean(savedLog), snap);
    hooked = result.hooked;
    if (result.nextSnapshot) snap = result.nextSnapshot;
  }

  return {
    detectedPath: logRes.detectedPath,
    hooked,
    snapshot: snap,
  };
}

/** Updates active passive spec and skill link groups whenever character level crosses a breakpoint. */
export function syncBuildSetsForLevel(
  snapshot: HudSessionSnapshot,
  build: ValidatedPobBuild | null,
): HudSessionSnapshot {
  if (!build) return snapshot;
  const adapter = getGameAdapter(snapshot.gameId);
  let next = snapshot;

  const activeSpec = selectActiveTreeSpec(build.treeSpecs, snapshot.characterLevel);
  if (activeSpec && activeSpec.title !== snapshot.passiveTree.specName) {
    const existingAllocated = (snapshot.passiveTree.allocatedNodeIds ?? [])
      .map((id) => Number(id))
      .filter(Number.isFinite);
    next = {
      ...next,
      passiveTree: computePassiveTreeDiff({
        treeSpecs: build.treeSpecs,
        allocatedHashes: existingAllocated,
        allocatedMasteries: snapshot.passiveTree.allocatedMasteries,
        ascendancyNoteOrderIds:
          build.ascendancyNoteOrderIds ?? snapshot.passiveTree.ascendancyNoteOrderIds,
        characterLevel: snapshot.characterLevel,
        adapter,
      }),
    };
  }

  const activeSet = selectActiveSkillSet(build.skillSets, snapshot.characterLevel);
  if (activeSet && snapshot.linkGroups[0]?.minLevel !== activeSet.minLevel) {
    const prevVerified = new Map(
      snapshot.gemSteps.map((s) => [s.id, { verifiedByApi: s.verifiedByApi, acquiredLocation: s.acquiredLocation }]),
    );
    const verified = verifySocketsAndGems({
      items: [],
      skillSets: build.skillSets,
      gemSteps: snapshot.gemSteps,
      characterLevel: snapshot.characterLevel,
    });
    next = {
      ...next,
      gemSteps: verified.updatedGemSteps.map((s) => {
        const prev = prevVerified.get(s.id);
        return {
          ...s,
          verifiedByApi: prev?.verifiedByApi ?? false,
          acquiredLocation: prev?.acquiredLocation,
        };
      }),
      linkGroups: verified.linkGroups,
      skillSets: verified.skillSets,
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

/** Collects deduplicated lowercase names/typeLines of actively equipped gear & tree jewels. */
export function extractEquippedItemNames(items: GggItemModRecord[]): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (item.inventoryId === "MainInventory") continue;
    for (const candidate of [item.name, item.typeLine]) {
      const normalized = candidate?.trim().toLowerCase();
      if (normalized) names.add(normalized);
    }
  }
  return [...names];
}

/** Extracts GGG get-passive-skills mastery_effects into a nodeId -> effectId map. */
export function extractAllocatedMasteriesFromPassives(
  passivesJson: Record<string, any> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = passivesJson?.mastery_effects;
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    if (k && v !== undefined && v !== null) out[String(k)] = String(v);
  }
  return out;
}
