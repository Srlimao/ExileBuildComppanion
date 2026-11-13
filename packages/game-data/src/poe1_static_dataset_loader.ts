import areasJson from "../data/poe1/areas.json" with { type: "json" };
import awakenedGemLookupJson from "../data/poe1/awakened-gem-lookup.json" with { type: "json" };
import charactersJson from "../data/poe1/characters.json" with { type: "json" };
import defaultRoutesJson from "../data/poe1/default_routes.json" with { type: "json" };
import gemColoursJson from "../data/poe1/gem-colours.json" with { type: "json" };
import gemsJson from "../data/poe1/gems.json" with { type: "json" };
import killWaypointsJson from "../data/poe1/kill-waypoints.json" with { type: "json" };
import passiveTreeGraphMetaJson from "../data/poe1/passive_tree_graph_meta.json" with { type: "json" };
import passiveTreeNodesJson from "../data/poe1/passive_tree_nodes.json" with { type: "json" };
import questsJson from "../data/poe1/quests.json" with { type: "json" };
import vaalGemLookupJson from "../data/poe1/vaal-gem-lookup.json" with { type: "json" };
import zoneLayoutManifestJson from "../data/poe1/zone_layout_manifest.json" with { type: "json" };
import type {
  AreaDefinition,
  CharacterStartGems,
  GemDefinition,
  PassiveTreeGraphMetadata,
  PassiveTreeNodeMetadata,
  QuestDefinition,
} from "./game_adapter_contract.js";

export const poe1Areas = areasJson as Record<string, AreaDefinition>;
export const poe1Gems = gemsJson as Record<string, GemDefinition>;
export const poe1Quests = questsJson as Record<string, QuestDefinition>;
export const poe1Characters = charactersJson as Record<string, CharacterStartGems>;
export const poe1GemColours = gemColoursJson as Record<string, string>;
export const poe1KillWaypoints = killWaypointsJson as Record<string, string[]>;
export const poe1AwakenedGemLookup = awakenedGemLookupJson as Record<string, string>;
export const poe1VaalGemLookup = vaalGemLookupJson as Record<string, string>;
export const poe1DefaultRoutes = defaultRoutesJson as Record<string, string>;
export const poe1ZoneLayoutManifest = zoneLayoutManifestJson as Record<string, string[]>;
export const poe1PassiveTreeNodes = passiveTreeNodesJson as Record<string, PassiveTreeNodeMetadata>;
export const poe1PassiveTreeGraphMeta = passiveTreeGraphMetaJson as PassiveTreeGraphMetadata;
