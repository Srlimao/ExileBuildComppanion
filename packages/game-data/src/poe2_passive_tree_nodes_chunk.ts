import nodesJson from "../data/poe2/passive_tree_nodes.json" with { type: "json" };
import type { PassiveTreeNodeMetadata } from "./game_adapter_contract.js";

export default nodesJson as Record<string, PassiveTreeNodeMetadata>;
