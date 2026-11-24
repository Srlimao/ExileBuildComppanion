import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { useHudTheme } from "../theme/hud_theme_provider.js";
import type { WeaponSetOverlayFilter } from "./passive_tree_spatial_index.js";

interface PassiveTreeWeaponSetLegendProps {
  weaponSet1Count: number;
  weaponSet2Count: number;
  filter: WeaponSetOverlayFilter;
  onChangeFilter: (next: WeaponSetOverlayFilter) => void;
}

/** Displays Crimson/Emerald Weapon Set 1 & 2 counts and filter pills on PoE 2 passive trees. */
export function PassiveTreeWeaponSetLegend({
  weaponSet1Count,
  weaponSet2Count,
  filter,
  onChangeFilter,
}: PassiveTreeWeaponSetLegendProps) {
  const { appMsg } = useHudI18n();
  const { treePalette } = useHudTheme();
  if (weaponSet1Count === 0 && weaponSet2Count === 0) return null;

  const options: Array<{ id: WeaponSetOverlayFilter; label: string; dotColor?: string; count?: number }> = [
    { id: "all", label: appMsg.poe2.weaponSetAll },
    { id: "set1", label: appMsg.poe2.weaponSet1, dotColor: treePalette.weaponSet1, count: weaponSet1Count },
    { id: "set2", label: appMsg.poe2.weaponSet2, dotColor: treePalette.weaponSet2, count: weaponSet2Count },
  ];

  return (
    <div
      data-tree-overlay-ui="true"
      className="inline-flex items-center gap-1 rounded-lg bg-hud-subtle/80 border border-hud-hairline p-0.5 text-[10px]"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChangeFilter(opt.id)}
          className={`px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors ${
            filter === opt.id
              ? "bg-hud-surface text-hud-text font-semibold shadow-sm"
              : "text-hud-muted hover:text-hud-text"
          }`}
        >
          {opt.dotColor && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.dotColor }} />
          )}
          <span>{opt.label}</span>
          {opt.count !== undefined && <span className="font-mono opacity-80">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}
