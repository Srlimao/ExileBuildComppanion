import {
  buildInitialSessionSnapshot,
  validateAndEnrichPobBuild,
  type HudSessionSnapshot,
  type ViewerToRoomMessage,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import { describe, expect, it, vi } from "vitest";
import { getDefaultOverlayLayoutForMode } from "../src/features/overlay_hud/overlay_default_grid_presets.js";
import {
  createHostOverlayBusServer,
  createOverlayViewerBusClient,
} from "../src/features/overlay_hud/overlay_local_bus.js";

function createTestSnapshot(): HudSessionSnapshot {
  const build = validateAndEnrichPobBuild(
    {
      buildName: "OverlayBusTest",
      characterClass: "Witch",
      ascendancyName: "Necromancer",
      bandit: "None",
      buildLevel: 1,
      skillSets: [],
      treeSpecs: [],
      itemSets: [],
      uniqueRequiredGems: [],
    },
    poe1GameAdapter,
  );
  return buildInitialSessionSnapshot({
    roomId: "LOCAL",
    profileId: "local-profile",
    build,
    checkpoints: [],
    gemSteps: [],
    adapter: poe1GameAdapter,
  });
}

describe("overlay_default_grid_presets", () => {
  it("provides dedicated compact layouts for FIELD, TOWN, LAB, and TREE_COMPACT", () => {
    const field = getDefaultOverlayLayoutForMode("FIELD");
    const town = getDefaultOverlayLayoutForMode("TOWN");
    const lab = getDefaultOverlayLayoutForMode("LAB");
    const treeCompact = getDefaultOverlayLayoutForMode("TREE_COMPACT");

    expect(field.map((i) => i.widgetId)).toEqual(["active_checklist", "zone_layout", "run_timer"]);
    expect(town.map((i) => i.widgetId)).toEqual([
      "vendor_shopping",
      "regex_sync",
      "socket_links",
      "resistance_cap",
    ]);
    expect(lab.map((i) => i.widgetId)).toEqual(["lab_compass", "run_timer", "resistance_cap"]);
    expect(treeCompact.map((i) => i.widgetId)).toEqual([
      "passive_tree",
      "socket_links",
      "resistance_cap",
    ]);
  });
});

describe("overlay_local_bus", () => {
  it("hydrates snapshot and relays commands between host and overlay without network calls", async () => {
    const channelName = `exile_local_hud_bus_test_${Date.now()}`;
    const snap = createTestSnapshot();
    const receivedSnapshots: HudSessionSnapshot[] = [];
    const receivedCommands: ViewerToRoomMessage[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const host = createHostOverlayBusServer({
      channelName,
      getLatestSnapshot: () => snap,
      onOverlayCommand: (cmd) => receivedCommands.push(cmd),
    });

    const overlay = createOverlayViewerBusClient((s) => receivedSnapshots.push(s), channelName);

    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(receivedSnapshots).toHaveLength(1);
    expect(receivedSnapshots[0]!.buildName).toBe("OverlayBusTest");

    overlay.sendCommand({ type: "viewer:toggle_checkpoint", checkpointId: "cp-1", completed: true });
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(receivedCommands).toEqual([
      { type: "viewer:toggle_checkpoint", checkpointId: "cp-1", completed: true },
    ]);

    const updatedSnap = { ...snap, version: snap.version + 1, currentAreaName: "The Coast" };
    host.broadcastSnapshot(updatedSnap);
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(receivedSnapshots).toHaveLength(2);
    expect(receivedSnapshots[1]!.currentAreaName).toBe("The Coast");
    expect(fetchSpy).not.toHaveBeenCalled();

    overlay.close();
    host.close();
    fetchSpy.mockRestore();
  });
});
