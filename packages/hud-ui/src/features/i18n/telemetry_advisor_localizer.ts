import type { GearHygieneIssue } from "@exile-hud/core";
import type { IzaroMechanicGuide } from "@exile-hud/game-data";
import type { HudLocale } from "./locale_storage_and_types.js";

const ELEM_PT_BR: Readonly<Record<string, string>> = {
  Fire: "Fogo",
  Cold: "Gelo",
  Lightning: "Raio",
  Chaos: "Caos",
};

const ATTR_PT_BR: Readonly<Record<string, string>> = {
  Strength: "Força",
  Dexterity: "Destreza",
  Intelligence: "Inteligência",
};

const BOSS_WARNINGS_PT_BR: Readonly<Record<string, string>> = {
  "Heavy Cold projectiles & chilled ground — Sapphire Ring recommended":
    "Projéteis pesados de Cold e chilled ground — Sapphire Ring recomendado",
  "Merveil Heavy Cold projectiles — Sapphire Ring recommended":
    "Merveil: projéteis pesados de Cold — Sapphire Ring recomendado",
  "Lightning beam & physical slam — Topaz Ring recommended":
    "Raio de Lightning e slam físico — Topaz Ring recomendado",
  "Touch of God Lightning slam & Blood Rain bleed":
    "Slam de Lightning (Touch of God) e bleed de Blood Rain",
  "High Fire/Physical arena traps & slams":
    "Armadilhas na arena e slams com alto dano de Fire/Físico",
  "Triggers -30% All Resistances immediately upon completion":
    "Aplica -30% All Resistances imediatamente ao derrotar",
  "Post-Kitava Cold & Lightning bursts — aim for 75% after -30%":
    "Rajadas de Cold e Lightning pós-Kitava — mire em 75% após -30%",
  "Heavy Fire & Cold beams; avoid crossing ground orbs":
    "Raios pesados de Fire e Cold; evite cruzar os orbes no chão",
  "Triggers final -60% All Resistances penalty for mapping":
    "Aplica a penalidade final de -60% All Resistances para mapas",
};

const IZARO_PT_BR: Readonly<Record<string, { hazard: string; counterplay: string }>> = {
  Charges: {
    hazard: "Charges acumulam muito dano e velocidade no Izaro",
    counterplay: "Clique nos Charge Disruptors antes que Izaro atinja 10 stacks",
  },
  Gargoyles: {
    hazard: "Stone Gargoyles dão dano e armadura ao Izaro",
    counterplay: "Mate todas as 3 Gargoyles antes de finalizar o Izaro",
  },
  Conduits: {
    hazard: "Elemental Conduits concedem dano Fire/Cold/Lightning",
    counterplay: "Destrua os Conduits imediatamente quando ativarem",
  },
  Fonts: {
    hazard: "Maldições aplicam Temp Chains / Enfeeble / Vuln",
    counterplay: "Destrua as Fonts ou mantenha um Anti-Curse flask pronto",
  },
  Portals: {
    hazard: "Invoca Skeletons e buffs de Necromancer",
    counterplay: "Mate os portais rápido para evitar acúmulo na Fase 3",
  },
  Idols: {
    hazard: "Estátuas elementais pulsam explosões em área",
    counterplay: "Não deixe Izaro perto de Idols ativos ou derreta ele rápido",
  },
};

/** Localizes a Crafting Bench prescription while keeping recipe label, slot, and currency names in English. */
export function localizeBenchPrescription(prescription: string, locale: HudLocale): string {
  if (locale === "en" || !prescription) return prescription;
  const m = /^Craft\s+(.+?)\s+on\s+(.+?)(\s*\([^)]+\))?$/i.exec(prescription.trim());
  if (!m) return prescription;
  return `Craftar ${m[1]} em ${m[2]}${m[3] ?? ""}`;
}

/** Localizes a Crafting Bench deficit summary. */
export function localizeBenchProblemSummary(summary: string, locale: HudLocale): string {
  if (locale === "en" || !summary) return summary;
  if (summary === "Boots have 0% Movement Speed") return "Botas com 0% Movement Speed";
  const res = /^(Fire|Cold|Lightning|Chaos)\s+Res\s+-(\d+)%\s+under\s+cap$/i.exec(summary);
  if (res) {
    const elem = ELEM_PT_BR[res[1]!] ?? res[1]!;
    return `Res de ${elem} -${res[2]}% abaixo do cap`;
  }
  const attr = /^Missing\s+(\d+)\s+(Strength|Dexterity|Intelligence)$/i.exec(summary);
  if (attr) {
    const label = ATTR_PT_BR[attr[2]!] ?? attr[2]!;
    return `Faltam ${attr[1]} de ${label}`;
  }
  return summary;
}

/** Localizes a GearHygieneIssue message while preserving item typeLine, Rustic Sash, and crafting recipes. */
export function localizeGearHygieneMessage(issue: GearHygieneIssue, locale: HudLocale): string {
  if (locale === "en") return issue.message;
  const msg = issue.message;
  if (msg === "No boots equipped past Act 2 — look for Movement Speed boots.") {
    return "Sem botas equipadas após o Ato 2 — procure botas com Movement Speed.";
  }
  if (msg === "Check Nessa / Tarkleigh for +10% Movement Speed boots") {
    return "Confira Nessa / Tarkleigh por botas com +10% Movement Speed";
  }
  let m: RegExpExecArray | null;
  if ((m = /^Boots have 0% Movement Speed in Act (\d+) — (.+)\.$/.exec(msg))) {
    const tail =
      m[2] === "craft or vendor MS boots"
        ? "crafte ou compre botas com MS no vendor"
        : localizeBenchPrescription(m[2]!, locale);
    return `Botas com 0% Movement Speed no Ato ${m[1]} — ${tail}.`;
  }
  if ((m = /^Outdated (.+?) \(Req Lv (\d+)\) at Character Lv (\d+) — upgrade at vendor\.$/.exec(msg))) {
    return `${m[1]} desatualizado (Req Nv ${m[2]}) no Nível ${m[3]} — melhore no vendor.`;
  }
  if ((m = /^Attack weapon "(.+?)" \(Req Lv (\d+)\) is (\d+) levels behind — use Rustic Sash recipe\.$/.exec(msg))) {
    return `Arma de ataque "${m[1]}" (Req Nv ${m[2]}) está ${m[3]} níveis atrás — use a receita de Rustic Sash.`;
  }
  return msg;
}

export function localizeBossWarning(warning: string | null, locale: HudLocale): string | null {
  if (!warning || locale === "en") return warning;
  return BOSS_WARNINGS_PT_BR[warning] ?? warning;
}

export function localizeIzaroGuide(guide: IzaroMechanicGuide, locale: HudLocale): IzaroMechanicGuide {
  if (locale === "en") return guide;
  const localized = IZARO_PT_BR[guide.phase];
  return localized ? { ...guide, ...localized } : guide;
}

export function localizePobFallbackText(text: string, locale: HudLocale): string {
  if (locale === "en" || !text) return text;
  if (text.startsWith("Endgame-only PoB detected")) {
    return "PoB apenas de endgame detectado (sem sets de leveling). Modo Nivelamento Fallback ativo: gemas ordenadas por disponibilidade de vendor por Ato.";
  }
  let m: RegExpExecArray | null;
  if ((m = /^Fallback Act (\d+\+?) \(Lv ([^)]+)\)$/.exec(text))) {
    return `Fallback Ato ${m[1]} (Nv ${m[2]})`;
  }
  return text;
}

export function localizePobSetDetail(detail: string, locale: HudLocale): string {
  if (locale === "en" || !detail) return detail;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)\s+nodes$/.exec(detail))) return `${m[1]} nós`;
  if ((m = /^(\d+)\s+groups\s+·\s+(\d+)\s+gems$/.exec(detail))) return `${m[1]} grupos · ${m[2]} gemas`;
  if ((m = /^(\d+)\s+slots$/.exec(detail))) return `${m[1]} slots`;
  return detail;
}

export function localizeConnectionOrSyncMessage(message: string | null, locale: HudLocale): string | null {
  if (!message || locale === "en") return message;
  if (message === "Connection rejected") return "Conexão recusada";
  if (message === "Room not found — check Room Code or click Sync Room on PC") {
    return "Sala não encontrada — confira o Código da Sala ou clique em Sincronizar Sala no PC";
  }
  if (message === "Invalid 4-digit PIN") return "PIN de 4 dígitos inválido";
  if (message === "Simulated GGG 429 outage active — using offline fallback targets") {
    return "Simulação de erro 429 da API GGG ativa — usando metas offline";
  }
  if (message === "Set AccountName#1234 and CharacterName first") {
    return "Defina Conta#1234 e Nome do Personagem primeiro";
  }
  if (message === "Synced via Public API") return "Sincronizado via API Pública";
  if (message === "Auto-synced via Public API") return "Sync automático via API Pública";
  if (message === "GGG HTTP fetch requires Windows Tauri desktop runtime (use Replay Simulator in browser preview).") {
    return "A consulta HTTP à GGG requer o app Windows Tauri (use o Simulador na prévia do navegador).";
  }
  let m: RegExpExecArray | null;
  if ((m = /^Retrying in (\d+)s$/.exec(message))) return `Tentando novamente em ${m[1]}s`;
  if ((m = /^Circuit breaker \/ cooldown active \((\d+)s remaining\)$/.exec(message))) {
    return `Cooldown ativo (${m[1]}s restantes)`;
  }
  if (message.includes("retrying in")) {
    return message
      .replace("Relay connection dropped", "Conexão com o Relay caiu")
      .replace("Relay unreachable", "Relay inacessível")
      .replace("retrying in", "tentando novamente em")
      .replace("— running offline locally", "— rodando offline localmente");
  }
  return message;
}
