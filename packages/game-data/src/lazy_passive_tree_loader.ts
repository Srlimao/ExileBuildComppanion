import type {
  PassiveTreeGraphMetadata,
  PassiveTreeNodeMetadata,
  SupportedGameId,
} from "./game_adapter_contract.js";
import { poe1GameAdapter } from "./poe1_campaign_game_adapter.js";
import { hydratePoe2PassiveTreeCache } from "./poe2_campaign_game_adapter.js";

export interface PassiveTreeDatasetBundle {
  nodes: Record<string, PassiveTreeNodeMetadata>;
  meta: PassiveTreeGraphMetadata;
}

let inFlightPoe2Load: Promise<PassiveTreeDatasetBundle> | null = null;
let loadedPoe2Bundle: PassiveTreeDatasetBundle | null = null;

/** Lazy-loads the passive tree dataset for `gameId` (code-split chunk for PoE 2). */
export async function loadPassiveTreeDataset(
  gameId: SupportedGameId,
): Promise<PassiveTreeDatasetBundle> {
  if (gameId !== "poe2") {
    return {
      nodes: poe1GameAdapter.getPassiveTreeNodes(),
      meta: poe1GameAdapter.getPassiveTreeGraphMeta(),
    };
  }
  if (loadedPoe2Bundle) return loadedPoe2Bundle;
  if (!inFlightPoe2Load) {
    inFlightPoe2Load = Promise.all([
      import("../data/poe2/passive_tree_nodes.json", { with: { type: "json" } }),
      import("../data/poe2/passive_tree_graph_meta.json", { with: { type: "json" } }),
    ]).then(([nodesMod, metaMod]) => {
      const nodes = (nodesMod.default ?? nodesMod) as Record<string, PassiveTreeNodeMetadata>;
      const meta = (metaMod.default ?? metaMod) as PassiveTreeGraphMetadata;
      hydratePoe2PassiveTreeCache(nodes, meta);
      loadedPoe2Bundle = { nodes, meta };
      return loadedPoe2Bundle;
    });
  }
  return inFlightPoe2Load;
}
