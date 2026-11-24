import type {
  BuildCatalogEntry,
  BuildCatalogFacetsResponse,
  BuildCatalogQueryResponse,
  BuildCatalogSource,
  BuildGoalTag,
  BuildPlaystyleTag,
  SupportedGameId,
} from "@exile-hud/core";
import { isTauriRuntime } from "../host_coordinator/tauri_ipc_adapter.js";

export interface BuildFinderOpenPayload {
  gameId: SupportedGameId;
  relayUrl: string;
}

export interface BuildFinderSelectionPayload {
  gameId: SupportedGameId;
  title: string;
  author: string;
  source: string;
  patchVersion: string;
  pobInput: string;
  guideUrl: string;
  leagueStart: boolean;
}

export interface BuildCatalogFilterQuery {
  gameId: SupportedGameId;
  baseClass?: string;
  ascendancy?: string;
  playstyleTags: BuildPlaystyleTag[];
  goalTags: BuildGoalTag[];
  source?: BuildCatalogSource;
  pobOnly: boolean;
  search?: string;
  sort: "recommended" | "updated" | "popular";
  limit?: number;
  offset?: number;
}

const PREVIEW_CHANNEL = "exile-build-finder-channel";

function normalizeRelayBaseUrl(relayUrl: string): string {
  const trimmed = relayUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "https://exile.dunhas.com";
}

export async function openBuildFinderWindowIpc(
  gameId: SupportedGameId,
  relayUrl: string,
): Promise<void> {
  if (!isTauriRuntime()) {
    const url = new URL(window.location.href);
    url.searchParams.set("window", "build-finder");
    url.searchParams.set("gameId", gameId);
    url.searchParams.set("relayUrl", normalizeRelayBaseUrl(relayUrl));
    window.open(url.toString(), "exile-build-finder", "width=980,height=700,resizable=yes");
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_build_finder_window", {
    gameId,
    relayUrl: normalizeRelayBaseUrl(relayUrl),
  });
}

export async function selectBuildFromFinderIpc(
  payload: BuildFinderSelectionPayload,
): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(PREVIEW_CHANNEL);
      ch.postMessage({ type: "selected", payload });
      ch.close();
    }
    window.close();
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("select_build_from_finder", { payload });
}

export async function closeBuildFinderWindowIpc(): Promise<void> {
  if (!isTauriRuntime()) {
    window.close();
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("close_build_finder_window");
}

export async function openExternalGuideUrlIpc(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://")) return;
  if (!isTauriRuntime()) {
    window.open(trimmed, "_blank", "noopener,noreferrer");
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_external_guide_url", { url: trimmed });
}

export async function subscribeBuildFinderOpened(
  onOpen: (payload: BuildFinderOpenPayload) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => undefined;
  const { listen } = await import("@tauri-apps/api/event");
  return listen<BuildFinderOpenPayload>("build-finder:opened", (ev) => {
    if (ev.payload) onOpen(ev.payload);
  });
}

export async function subscribeBuildFinderSelected(
  onSelect: (payload: BuildFinderSelectionPayload) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    if (typeof BroadcastChannel === "undefined") return () => undefined;
    const ch = new BroadcastChannel(PREVIEW_CHANNEL);
    const handler = (ev: MessageEvent<{ type?: string; payload?: BuildFinderSelectionPayload }>) => {
      if (ev.data?.type === "selected" && ev.data.payload) onSelect(ev.data.payload);
    };
    ch.addEventListener("message", handler);
    return () => {
      ch.removeEventListener("message", handler);
      ch.close();
    };
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<BuildFinderSelectionPayload>("build-finder:selected", (ev) => {
    if (ev.payload) onSelect(ev.payload);
  });
}

export async function fetchBuildCatalogFacets(
  relayUrl: string,
  gameId: SupportedGameId,
  pobOnly: boolean,
): Promise<BuildCatalogFacetsResponse> {
  const base = normalizeRelayBaseUrl(relayUrl);
  const url = new URL(`${base}/api/builds/facets`);
  url.searchParams.set("gameId", gameId);
  url.searchParams.set("pobOnly", pobOnly ? "true" : "false");
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Catalog facets returned HTTP ${res.status}`);
  return (await res.json()) as BuildCatalogFacetsResponse;
}

export async function fetchBuildCatalogEntries(
  relayUrl: string,
  query: BuildCatalogFilterQuery,
): Promise<BuildCatalogQueryResponse> {
  const base = normalizeRelayBaseUrl(relayUrl);
  const url = new URL(`${base}/api/builds/catalog`);
  url.searchParams.set("gameId", query.gameId);
  if (query.baseClass) url.searchParams.set("baseClass", query.baseClass);
  if (query.ascendancy) url.searchParams.set("ascendancy", query.ascendancy);
  if (query.playstyleTags.length > 0) {
    url.searchParams.set("playstyle", query.playstyleTags.join(","));
  }
  if (query.goalTags.length > 0) url.searchParams.set("goal", query.goalTags.join(","));
  if (query.source) url.searchParams.set("source", query.source);
  url.searchParams.set("pobOnly", query.pobOnly ? "true" : "false");
  if (query.search?.trim()) url.searchParams.set("search", query.search.trim());
  url.searchParams.set("sort", query.sort);
  url.searchParams.set("limit", String(query.limit ?? 60));
  url.searchParams.set("offset", String(query.offset ?? 0));
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Catalog query returned HTTP ${res.status}`);
  return (await res.json()) as BuildCatalogQueryResponse;
}

export async function resolveBuildPobInputForSelection(
  relayUrl: string,
  entry: BuildCatalogEntry,
): Promise<string> {
  if (!entry.pobUrl) return "";
  if (entry.pobKind === "maxroll_pob") {
    try {
      const base = normalizeRelayBaseUrl(relayUrl);
      const url = new URL(`${base}/api/builds/resolve-pob`);
      url.searchParams.set("url", entry.pobUrl);
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (res.ok) {
        const body = (await res.json()) as { pobCode?: string };
        if (body.pobCode?.trim()) return body.pobCode.trim();
      }
    } catch {
      // Fall back to the direct Maxroll PoB URL; core resolver handles it directly too.
    }
  }
  return entry.pobUrl;
}
