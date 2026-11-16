import {
  buildPreprocessorDefinitions,
  combineRouteActFiles,
  parsePreprocessedRouteLines,
  preprocessRouteConditionals,
} from "@exile-hud/core";
import { poe1GameAdapter } from "@exile-hud/game-data";
import {
  DEFAULT_HUD_LOCALE,
  HUD_LOCALE_STORAGE_KEY,
  getLocalizedWidgetCatalog,
  loadSavedHudLocale,
  localizeBenchPrescription,
  localizeBenchProblemSummary,
  localizeBossWarning,
  localizeConnectionOrSyncMessage,
  localizeGearHygieneMessage,
  localizeHudModeLabel,
  localizeIzaroGuide,
  localizePobFallbackText,
  localizePobSetDetail,
  localizeRouteStepTitle,
  localizeRouteSubNote,
  parseSavedHudLocale,
  saveHudLocale,
  subscribeHudLocaleChanges,
  type HudLocale,
} from "@exile-hud/hud-ui";
import { afterEach, describe, expect, it } from "vitest";

function installMockBrowserGlobals(): {
  store: Map<string, string>;
  listeners: Map<string, Set<(ev: unknown) => void>>;
  restore: () => void;
} {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(ev: unknown) => void>>();
  const origWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const origDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
  const docEl = { lang: "en" };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: docEl },
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
      },
      addEventListener: (type: string, fn: (ev: unknown) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (ev: unknown) => void) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: (ev: { type?: string; detail?: unknown }) => {
        const set = listeners.get(ev.type ?? "");
        if (set) {
          for (const fn of set) fn(ev);
        }
        return true;
      },
    },
  });

  return {
    store,
    listeners,
    restore: () => {
      if (origWindow) Object.defineProperty(globalThis, "window", origWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (origDoc) Object.defineProperty(globalThis, "document", origDoc);
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe("HUD locale persistence and cross-window sync", () => {
  it("defaults to pt-BR and persists/notifies EN toggles cleanly", () => {
    expect(DEFAULT_HUD_LOCALE).toBe("pt-BR");
    expect(HUD_LOCALE_STORAGE_KEY).toBe("exile_hud_locale_v1");
    expect(parseSavedHudLocale(null)).toBe("pt-BR");
    expect(parseSavedHudLocale("invalid")).toBe("pt-BR");
    expect(parseSavedHudLocale("en")).toBe("en");
    expect(parseSavedHudLocale(JSON.stringify("en"))).toBe("en");

    const env = installMockBrowserGlobals();
    cleanup = env.restore;
    expect(loadSavedHudLocale()).toBe("pt-BR");

    const observed: HudLocale[] = [];
    const unsub = subscribeHudLocaleChanges((next) => observed.push(next));

    saveHudLocale("en");
    expect(env.store.get(HUD_LOCALE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(loadSavedHudLocale()).toBe("en");
    expect(observed).toEqual(["en"]);

    for (const fn of env.listeners.get("storage") ?? []) {
      fn({ key: HUD_LOCALE_STORAGE_KEY, newValue: "pt-BR" });
    }
    expect(observed).toEqual(["en", "pt-BR"]);
    expect(document.documentElement.lang).toBe("pt-BR");
    unsub();
  });
});

describe("Full 10-act campaign route localization with English PoE entities preserved", () => {
  const configs = [
    { leagueStart: true, bandit: "Alira" as const, includeLibrary: true },
    { leagueStart: false, bandit: "None" as const, includeLibrary: false },
    { leagueStart: true, bandit: "Oak" as const, includeLibrary: false },
    { leagueStart: true, bandit: "Kraityn" as const, includeLibrary: false },
  ];

  const untranslatedStepStart =
    /^(Find|Enter|Relog to|Hand in|Turn in|Get|Take|Kill|Talk to|Poison|Burn|Break|Free|Activate|Light|Select|Open|Place|Help)\b|^Complete\s+(?:Complete|Labyrinth|Pillar|(?:normal|cruel|merciless|uber)\s+Labyrinth)\b/;
  const untranslatedSubStart =
    /^(Go|Follow|Look|Search|Recommended Level:|Farm Level:|Usually|Vendor|Type|Interact|Put currency|Stairs spawn|First floor|Remaining floors|Black splashes|Little streams|If you find|Try go|S shape|At the fork|In the room|Typically|High chance)\b/;

  it("translates every Act 1-10 route step and #sub note to PT-BR while keeping English PoE names", () => {
    const raw = combineRouteActFiles(poe1GameAdapter.getDefaultRouteFiles());
    let totalSteps = 0;
    let totalSubs = 0;

    for (const cfg of configs) {
      const steps = parsePreprocessedRouteLines(
        preprocessRouteConditionals(raw, buildPreprocessorDefinitions(cfg)),
        poe1GameAdapter,
      );
      for (const step of steps) {
        totalSteps += 1;
        expect(localizeRouteStepTitle(step.renderedText, "en")).toBe(step.renderedText);
        const ptTitle = localizeRouteStepTitle(step.renderedText, "pt-BR");
        expect(ptTitle, `Untranslated step: "${step.renderedText}" -> "${ptTitle}"`).not.toMatch(
          untranslatedStepStart,
        );

        for (const sub of step.subNotes) {
          totalSubs += 1;
          expect(localizeRouteSubNote(sub, "en")).toBe(sub);
          const ptSub = localizeRouteSubNote(sub, "pt-BR");
          expect(ptSub, `Untranslated subnote: "${sub}" -> "${ptSub}"`).not.toMatch(untranslatedSubStart);
        }
      }
    }

    expect(totalSteps).toBeGreaterThan(800);
    expect(totalSubs).toBeGreaterThan(150);
    expect(localizeRouteStepTitle("Find and kill Kill Hillock", "pt-BR")).toBe("Encontre e mate Hillock");
    expect(localizeRouteStepTitle("Hand in Enemy at the Gate (Tarkleigh)", "pt-BR")).toBe(
      "Entregue Enemy at the Gate (Tarkleigh)",
    );
    expect(localizeRouteStepTitle("Enter Lioneye's Watch", "pt-BR")).toBe("Entre em Lioneye's Watch");
    expect(localizeRouteStepTitle("Complete normal Labyrinth", "pt-BR")).toBe("Complete o Labirinto Normal");
    expect(localizeRouteStepTitle("Complete Pillar Push", "pt-BR")).toBe("Faça o Pillar Push");
    expect(localizeRouteSubNote("Vendor Quicksilver Flask + Orb of Augmentation + Normal Boots", "pt-BR")).toContain(
      "Quicksilver Flask + Orb of Augmentation + Normal Boots",
    );
    expect(
      localizeRouteSubNote("Type /passives in chat to confirm that you have all 24 passives from quests", "pt-BR"),
    ).toContain("/passives");
  });
});

describe("Mode labels, widget catalog, and telemetry advisor localization", () => {
  it("localizes modes, widget catalog, and advisors while keeping item/currency/boss names in English", () => {
    expect(localizeHudModeLabel("FIELD", "pt-BR")).toBe("CAMPO");
    expect(localizeHudModeLabel("TOWN", "pt-BR")).toBe("CIDADE");
    expect(localizeHudModeLabel("TREE", "pt-BR")).toBe("ÁRVORE");
    expect(localizeHudModeLabel("STANDBY", "pt-BR")).toBe("ESPERA");
    expect(localizeHudModeLabel("LAB", "pt-BR")).toBe("LAB");

    const ptCatalog = getLocalizedWidgetCatalog("pt-BR");
    const enCatalog = getLocalizedWidgetCatalog("en");
    expect(ptCatalog).toHaveLength(enCatalog.length);
    expect(ptCatalog.find((w) => w.widgetId === "resistance_cap")?.label).toBe("Resistências");

    expect(localizeBenchProblemSummary("Cold Res -14% under cap", "pt-BR")).toBe("Res de Gelo -14% abaixo do cap");
    expect(localizeBenchPrescription("Craft 16-20% Cold Res on Gloves (1x Orb of Transmutation)", "pt-BR")).toBe(
      "Craftar 16-20% Cold Res em Gloves (1x Orb of Transmutation)",
    );
    expect(
      localizeGearHygieneMessage(
        {
          id: "weapon_underleveled",
          severity: "warn",
          slot: "weapon",
          message: 'Attack weapon "Rusted Sword" (Req Lv 1) is 25 levels behind — use Rustic Sash recipe.',
        },
        "pt-BR",
      ),
    ).toBe('Arma de ataque "Rusted Sword" (Req Nv 1) está 25 níveis atrás — use a receita de Rustic Sash.');

    for (const w of poe1GameAdapter.getBossElementalWarnings(1).concat(poe1GameAdapter.getBossElementalWarnings(6))) {
      const ptWarn = localizeBossWarning(w.warningText, "pt-BR");
      expect(ptWarn).not.toBe(w.warningText);
    }
    expect(localizeBossWarning("Heavy Cold projectiles & chilled ground — Sapphire Ring recommended", "pt-BR")).toContain(
      "Sapphire Ring",
    );

    const izaro = localizeIzaroGuide(poe1GameAdapter.getIzaroMechanics()[0]!, "pt-BR");
    expect(izaro.phase).toBe("Charges");
    expect(izaro.counterplay).toContain("Charge Disruptors");

    expect(localizePobSetDetail("14 nodes", "pt-BR")).toBe("14 nós");
    expect(localizePobFallbackText("Fallback Act 1 (Lv 1–11)", "pt-BR")).toBe("Fallback Ato 1 (Nv 1–11)");
    expect(localizeConnectionOrSyncMessage("Invalid 4-digit PIN", "pt-BR")).toBe("PIN de 4 dígitos inválido");
  });
});
