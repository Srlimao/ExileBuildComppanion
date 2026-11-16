import type { HudLocale } from "./locale_storage_and_types.js";

const ASCEND_DIFFICULTY_PT: Readonly<Record<string, string>> = {
  normal: "Normal",
  cruel: "Cruel",
  merciless: "Merciless",
  uber: "Uber",
};

/** Translates a single non-compound AST fragment/clause to PT-BR while preserving English PoE proper nouns. */
function translateSingleClausePtBr(clause: string): string {
  const c = clause.trim();
  if (!c) return c;

  const exactMap: Readonly<Record<string, string>> = {
    "Get Get Waypoint": "Pegue o Waypoint",
    "Get Waypoint": "Pegue o Waypoint",
    "Find Get Waypoint": "Encontre o Waypoint",
    "Complete Complete Labyrinth Trial": "Complete a Trial do Labirinto",
    "Complete Labyrinth Trial": "Complete a Trial do Labirinto",
    "Get Unlock Crafting Recipe": "Desbloqueie a Receita de Craft",
    "Unlock Crafting Recipe": "Desbloqueie a Receita de Craft",
    "Set Portal": "Abra um Portal",
    "Take Use Portal": "Use o Portal",
    "Use Portal": "Use o Portal",
    "Place Set Portal in the plaza": "Abra um Portal na praça",
    "Complete Pillar Push": "Faça o Pillar Push",
    "Kill Kill Everything": "Mate tudo",
    "Kill Everything": "Mate tudo",
  };
  if (exactMap[c]) return exactMap[c]!;

  let m: RegExpExecArray | null;

  if ((m = /^WP\s*->\s*(.+)$/i.exec(c))) return `WP -> ${m[1]}`;
  if ((m = /^Complete\s+(normal|cruel|merciless|uber)\s+Labyrinth$/i.exec(c))) {
    const diff = ASCEND_DIFFICULTY_PT[m[1]!.toLowerCase()] ?? m[1]!;
    return `Complete o Labirinto ${diff}`;
  }
  if ((m = /^Get\s+Recipe:\s*(.+)$/i.exec(c))) return `Pegue Receita: ${m[1]}`;
  if ((m = /^Recipe:\s*(.+)$/i.exec(c))) return `Receita: ${m[1]}`;
  if ((m = /^get\s+Recipe:\s*(.+)$/i.exec(c))) return `pegue Receita: ${m[1]}`;
  if ((m = /^get\s+Unlock Crafting Recipe$/i.exec(c))) return "desbloqueie a Receita de Craft";
  if ((m = /^get\s+Get Waypoint$/i.exec(c))) return "pegue o Waypoint";
  if ((m = /^Reward:\s*(.+)$/i.exec(c))) return `Recompensa: ${m[1]}`;
  if ((m = /^Buy:\s*(.+)$/i.exec(c))) return `Comprar: ${m[1]}`;

  if ((m = /^(?:Hand|Turn)\s+in\s+(?:Turn\s+in\s+)?(.+)$/i.exec(c))) return `Entregue ${m[1]}`;
  if ((m = /^Enter\s+(.+)$/i.exec(c))) return `Entre em ${m[1]}`;
  if ((m = /^Relog\s+to\s+(.+)$/i.exec(c))) return `Relogue para ${m[1]}`;
  if ((m = /^Find\s+and\s+kill\s+(?:Kill\s+)?(.+)$/i.exec(c))) return `Encontre e mate ${m[1]}`;
  if ((m = /^Find\s+and\s+help\s+(?:Kill\s+)?(.+)$/i.exec(c))) return `Encontre e ajude ${m[1]}`;
  if ((m = /^Help\s+and\s+talk\s+to\s+(.+)$/i.exec(c))) return `Ajude e fale com ${m[1]}`;
  if ((m = /^Help\s+(?:Kill\s+)?(.+)$/i.exec(c))) return `Ajude ${m[1]}`;
  if ((m = /^Talk\s+to\s+(.+)$/i.exec(c))) return `Fale com ${m[1]}`;
  if ((m = /^Kill\s+(?:Kill\s+)?(.+)$/i.exec(c))) {
    const cleaned = m[1]!.replace(/\s+&\s+Kill\s+/g, " & ");
    return `Mate ${cleaned}`;
  }
  if ((m = /^kill\s+(?:Kill\s+)?(.+)$/.exec(c))) {
    const cleaned = m[1]!.replace(/\s+&\s+Kill\s+/g, " & ");
    return `mate ${cleaned}`;
  }
  if ((m = /^Find\s+and\s+take\s+(.+)$/i.exec(c))) return `Encontre e pegue ${m[1]}`;
  if ((m = /^Find\s+(.+)\s+to\s+next\s+floor$/i.exec(c))) return `Encontre ${m[1]} para o próximo andar`;
  if ((m = /^Find\s+(.+)$/i.exec(c))) return `Encontre ${m[1]}`;
  if ((m = /^Take\s+the\s+(.+)$/i.exec(c))) return `Pegue o ${m[1]}`;
  if ((m = /^Take\s+(.+)$/i.exec(c))) return `Pegue ${m[1]}`;
  if ((m = /^Poison\s+the\s+(.+)$/i.exec(c))) return `Envenene ${m[1]}`;
  if ((m = /^Burn\s+the\s+(.+)$/i.exec(c))) return `Queime ${m[1]}`;
  if ((m = /^Break\s+(.+)$/i.exec(c))) return `Quebre ${m[1]}`;
  if ((m = /^Free\s+(.+)$/i.exec(c))) return `Liberte ${m[1]}`;
  if ((m = /^Open\s+(.+)$/i.exec(c))) return `Abra ${m[1]}`;
  if ((m = /^Light\s+the\s+(.+)$/i.exec(c))) return `Acenda ${m[1]}`;
  if ((m = /^Activate\s+(.+)\s+with\s+(.+)$/i.exec(c))) return `Ative ${m[1]} com ${m[2]}`;
  if ((m = /^Activate\s+(.+)$/i.exec(c))) return `Ative ${m[1]}`;
  if ((m = /^Select\s+(.+)$/i.exec(c))) return `Selecione ${m[1]}`;
  if ((m = /^Complete\s+(.+)$/i.exec(c))) return `Complete ${m[1]}`;
  if ((m = /^place\s+Set\s+Portal$/i.exec(c))) return "abra um Portal";
  if ((m = /^take\s+(.+)$/.exec(c))) return `pegue ${m[1]}`;
  if ((m = /^activate\s+(.+)$/.exec(c))) return `ative ${m[1]}`;
  if ((m = /^use\s+(.+)$/.exec(c))) return `use ${m[1]}`;
  if ((m = /^throw\s+in\s+(.+)$/.exec(c))) return `jogue ${m[1]}`;
  if ((m = /^search\s+in\s+the\s+corners\s+of\s+the\s+map$/i.exec(c))) return "procure nos cantos do mapa";
  if (c === "Sail to Wraeclast") return "navegue para Wraeclast";
  if (c === "Set Sail from Oriath") return "zarpe de Oriath";
  if ((m = /^sail\s+to\s+Enter\s+(.+)$/i.exec(c))) return `navegue para ${m[1]}`;
  if ((m = /^sail\s+to\s+(.+)$/i.exec(c))) return `navegue para ${m[1]}`;
  if (c === "Before Waypoint") return "Antes do Waypoint";
  if (c === "complete Complete Labyrinth Trial" || c === "complete Labyrinth Trial") {
    return "complete a Trial do Labirinto";
  }

  return c;
}

/** Localizes a campaign route checkpoint title while preserving PoE quest, area, boss, NPC, and item names in English. */
export function localizeRouteStepTitle(title: string, locale: HudLocale): string {
  if (locale === "en" || !title) return title;

  if (title.includes(" ➞ ")) {
    return title
      .split(" ➞ ")
      .map((segment) => localizeRouteStepTitle(segment, locale))
      .join(" ➞ ");
  }

  // Split only on commas that precede a known English route clause (never on boss titles like "Brutus, Lord Incarcerator").
  const segments = title.split(
    /,\s+(?=(?:kill|Kill|take|get|activate|use|place|throw\s+in|search\s+in\s+the\s+corners|Sail\s+to|sail\s+to|Set\s+Sail|complete\s+(?:Complete\s+)?Labyrinth\s+Trial)\b)/,
  );

  if (segments.length === 1) {
    return translateSingleClausePtBr(title);
  }

  return segments.map((seg) => translateSingleClausePtBr(seg)).join(", ");
}
