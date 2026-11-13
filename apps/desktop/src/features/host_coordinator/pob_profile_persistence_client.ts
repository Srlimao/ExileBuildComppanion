import type { HudSessionSnapshot, PobSetSelection, ValidatedPobBuild } from "@exile-hud/core";
import type { CompiledProfileBundle } from "./desktop_telemetry_bridge.js";
import {
  getPobProfileStoragePathIpc,
  isTauriRuntime,
  loadSavedPobProfileIpc,
  openAppDataFolderIpc,
  savePobProfileIpc,
} from "./tauri_ipc_adapter.js";

export interface SavedPobProfileRecord {
  rawInput: string;
  cachedXml: string | null;
  leagueStart: boolean;
  customRouteText: string;
  selection: PobSetSelection | null;
  updatedAtMs: number;
}

const WEB_FALLBACK_KEY = "exile_saved_pob_profile_v1";

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
  <Items activeItemSet="1">
    <Item id="1">
Rarity: MAGIC
Driftwood Wand
Sockets: B-B-G
LevelReq: 1
Implicits: 0
+12% increased Fire Damage
    </Item>
    <ItemSet id="1" title="Act 1 Starter">
      <Slot name="Weapon 1" itemId="1"/>
    </ItemSet>
  </Items>
</PathOfBuilding>`;

/** Returns the Windows AppData file path (or browser storage label) where PoB profiles live. */
export async function fetchPobProfileStoragePath(): Promise<string> {
  const path = await getPobProfileStoragePathIpc();
  if (path) return path;
  return "Browser localStorage (exile_saved_pob_profile_v1)";
}

/** Loads the last saved PoB profile from AppData JSON (or browser localStorage in preview). */
export async function loadSavedPobProfile(): Promise<SavedPobProfileRecord | null> {
  if (isTauriRuntime()) {
    return loadSavedPobProfileIpc();
  }
  try {
    const raw = localStorage.getItem(WEB_FALLBACK_KEY);
    return raw ? (JSON.parse(raw) as SavedPobProfileRecord) : null;
  } catch {
    return null;
  }
}

/** Saves the active PoB profile (with cached XML and set selection) to AppData JSON. */
export async function persistSavedPobProfile(record: SavedPobProfileRecord): Promise<string | null> {
  if (isTauriRuntime()) {
    return savePobProfileIpc(record);
  }
  localStorage.setItem(WEB_FALLBACK_KEY, JSON.stringify(record));
  return null;
}

/** Opens the Windows AppData folder containing saved_pob_profile.json in Explorer. */
export async function openPobStorageFolder(): Promise<string | null> {
  return openAppDataFolderIpc();
}

export type CompileProfileFn = (params: {
  roomId: string;
  profileId: string;
  rawPobInput: string;
  cachedXml?: string | null;
  selection?: PobSetSelection | null;
  customRouteText?: string;
  leagueStart: boolean;
  characterName?: string;
}) => Promise<CompiledProfileBundle>;

/** Loads persisted PoB from AppData and compiles it (falling back cleanly to starter PoB). */
export async function loadInitialSavedOrDefaultProfile(
  params: { roomId: string; characterName: string },
  compileFn: CompileProfileFn,
): Promise<{
  compiled: CompiledProfileBundle;
  rawInput: string;
  leagueStart: boolean;
  customRouteText: string;
  storagePath: string;
}> {
  const [saved, storagePath] = await Promise.all([
    loadSavedPobProfile().catch(() => null),
    fetchPobProfileStoragePath().catch(() => ""),
  ]);

  const rawInput = saved?.rawInput?.trim() ? saved.rawInput : DEFAULT_STARTER_POB_XML;
  const leagueStart = saved ? saved.leagueStart : true;
  const customRouteText = saved?.customRouteText ?? "";

  try {
    const compiled = await compileFn({
      roomId: params.roomId,
      profileId: saved ? "saved-user-build" : "default-starter",
      rawPobInput: rawInput,
      cachedXml: saved?.cachedXml ?? null,
      selection: saved?.selection ?? null,
      customRouteText,
      leagueStart,
      characterName: params.characterName,
    });
    return { compiled, rawInput, leagueStart, customRouteText, storagePath };
  } catch {
    const fallback = await compileFn({
      roomId: params.roomId,
      profileId: "default-starter",
      rawPobInput: DEFAULT_STARTER_POB_XML,
      leagueStart: true,
      characterName: params.characterName,
    });
    return {
      compiled: fallback,
      rawInput: DEFAULT_STARTER_POB_XML,
      leagueStart: true,
      customRouteText: "",
      storagePath,
    };
  }
}

/** Compiles the active PoB profile, syncs sets for character level, and saves to AppData JSON. */
export async function compileAndSavePobProfile(
  params: {
    roomId: string;
    characterName: string;
    previousSnapshot: HudSessionSnapshot | null;
    pobInput: string;
    cachedXml?: string | null;
    selection?: PobSetSelection | null;
    leagueStart: boolean;
    customRouteText: string;
  },
  compileFn: (args: Parameters<CompileProfileFn>[0] & { previousSnapshot?: HudSessionSnapshot | null }) => Promise<CompiledProfileBundle>,
  syncLevelFn: (snapshot: HudSessionSnapshot, build: ValidatedPobBuild | null) => HudSessionSnapshot,
): Promise<{ compiled: CompiledProfileBundle; syncedSnapshot: HudSessionSnapshot }> {
  const compiled = await compileFn({
    roomId: params.roomId,
    profileId: "user-build",
    rawPobInput: params.pobInput,
    cachedXml: params.cachedXml,
    selection: params.selection,
    customRouteText: params.customRouteText,
    leagueStart: params.leagueStart,
    characterName: params.characterName,
    previousSnapshot: params.previousSnapshot,
  });
  await persistSavedPobProfile({
    rawInput: params.pobInput,
    cachedXml: compiled.decodedXml,
    leagueStart: params.leagueStart,
    customRouteText: params.customRouteText,
    selection: compiled.selection,
    updatedAtMs: Date.now(),
  });
  return { compiled, syncedSnapshot: syncLevelFn(compiled.snapshot, compiled.build) };
}
