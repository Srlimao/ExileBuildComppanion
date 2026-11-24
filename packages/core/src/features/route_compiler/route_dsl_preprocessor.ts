export interface RouteCompileOptions {
  leagueStart: boolean;
  bandit: "None" | "Oak" | "Kraityn" | "Alira";
  includeLibrary: boolean;
  customRouteText?: string | null;
}

export function buildPreprocessorDefinitions(options: RouteCompileOptions): Set<string> {
  const defs = new Set<string>();
  if (options.leagueStart) defs.add("LEAGUE_START");
  if (options.includeLibrary) defs.add("LIBRARY");

  switch (options.bandit) {
    case "Alira":
      defs.add("BANDIT_ALIRA");
      break;
    case "Oak":
      defs.add("BANDIT_OAK");
      break;
    case "Kraityn":
      defs.add("BANDIT_KRAITYN");
      break;
    default:
      defs.add("BANDIT_KILL");
      break;
  }

  return defs;
}

export function combineRouteActFiles(defaultRoutes: Record<string, string>, customRouteText?: string | null): string {
  if (customRouteText && customRouteText.trim().length > 0) {
    return customRouteText;
  }
  const acts: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const content = defaultRoutes[`act-${i}`];
    if (content) acts.push(content);
  }
  for (let i = 1; i <= 3; i++) {
    const content = defaultRoutes[`interlude-${i}`];
    if (content) acts.push(content);
  }
  return acts.join("\n");
}

export function preprocessRouteConditionals(rawSource: string, defs: Set<string>): string[] {
  const lines = rawSource.split(/\r\n|\r|\n/);
  const output: string[] = [];
  const stack: boolean[] = [];

  const isActive = () => stack.every(Boolean);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const ifdefMatch = /^#ifdef\s+(\S+)/.exec(trimmed);
    if (ifdefMatch?.[1]) {
      stack.push(defs.has(ifdefMatch[1]));
      continue;
    }

    const ifndefMatch = /^#ifndef\s+(\S+)/.exec(trimmed);
    if (ifndefMatch?.[1]) {
      stack.push(!defs.has(ifndefMatch[1]));
      continue;
    }

    if (/^#endif\b/.test(trimmed)) {
      stack.pop();
      continue;
    }

    if (isActive()) {
      output.push(trimmed);
    }
  }

  return output;
}
