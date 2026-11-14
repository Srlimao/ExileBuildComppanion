import type { GearHygieneIssue } from "../protocol/session_room_wire_protocol.js";
import { extractGggItemModLines, type GggItemModRecord } from "./equipped_resistance_estimator.js";

function getRequiredLevel(item: GggItemModRecord): number {
  const req = item.requirements?.find((r) => r.name === "Level");
  const raw = req?.values?.[0]?.[0];
  return raw ? Number.parseInt(raw, 10) || 1 : 1;
}

function getMovementSpeedPercent(boots: GggItemModRecord): number {
  const mods = extractGggItemModLines(boots);
  let total = 0;
  for (const mod of mods) {
    const match = /(\d+)%\s+increased Movement Speed/i.exec(mod);
    if (match?.[1]) total += Number.parseInt(match[1], 10);
  }
  return total;
}

export function auditGearAndFlaskHygiene(params: {
  items: GggItemModRecord[];
  characterLevel: number;
  highestUnlockedAct: number;
  isAttackBuild: boolean;
}): GearHygieneIssue[] {
  const { items, characterLevel, highestUnlockedAct, isAttackBuild } = params;
  const issues: GearHygieneIssue[] = [];

  const boots = items.find((i) => i.inventoryId === "Boots");
  if (highestUnlockedAct >= 3) {
    if (!boots) {
      issues.push({
        id: "boots_missing",
        severity: "warn",
        slot: "boots",
        message: "No boots equipped past Act 2 — look for Movement Speed boots.",
      });
    } else if (getMovementSpeedPercent(boots) === 0) {
      issues.push({
        id: "boots_0ms",
        severity: "warn",
        slot: "boots",
        message: `Boots have 0% Movement Speed in Act ${highestUnlockedAct} — craft or vendor MS boots.`,
      });
    }
  }

  const flasks = items.filter((i) => i.inventoryId === "Flask");
  const lifeOrManaFlasks = flasks.filter((f) => /life flask|mana flask|hybrid flask/i.test(f.typeLine));
  for (const flask of lifeOrManaFlasks) {
    const reqLvl = getRequiredLevel(flask);
    if (characterLevel >= 24 && characterLevel - reqLvl >= 16) {
      issues.push({
        id: `flask_${flask.typeLine}`,
        severity: "info",
        slot: "flask",
        message: `Outdated ${flask.typeLine} (Req Lv ${reqLvl}) at Character Lv ${characterLevel} — upgrade at vendor.`,
      });
    }
  }

  if (isAttackBuild) {
    const weapon = items.find((i) => i.inventoryId === "Weapon");
    if (weapon && !/wand|sceptre/i.test(weapon.baseType ?? weapon.typeLine)) {
      const reqLvl = getRequiredLevel(weapon);
      if (characterLevel >= 20 && characterLevel - reqLvl >= 15) {
        issues.push({
          id: "weapon_underleveled",
          severity: "warn",
          slot: "weapon",
          message: `Attack weapon "${weapon.typeLine}" (Req Lv ${reqLvl}) is ${characterLevel - reqLvl} levels behind — use Rustic Sash recipe.`,
        });
      }
    }
  }

  return issues;
}
