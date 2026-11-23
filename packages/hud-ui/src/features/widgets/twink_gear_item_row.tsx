import type { RecommendedTwinkItem } from "@exile-hud/core";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";

interface TwinkGearItemRowProps {
  item: RecommendedTwinkItem;
}

/** Compact twink gear row with official 2D item art, status badges, and inline mod expansion. */
export function TwinkGearItemRow({ item }: TwinkGearItemRowProps) {
  const { locale, msg } = useHudI18n();
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const t = msg.widgets.twinkGear;
  const summary = locale === "pt-BR" ? item.summaryPtBr : item.summaryEn;
  const showImage = Boolean(item.iconUrl) && !imgError;

  return (
    <div className={`py-1.5 first:pt-0 ${item.equipped ? "opacity-80" : ""}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-center gap-2.5 group cursor-pointer rounded-lg px-1.5 py-1 hover:bg-hud-subtle/45 transition-colors"
      >
        <div className="h-9 w-9 shrink-0 rounded-lg bg-hud-subtle/80 border border-hud-hairline flex items-center justify-center p-0.5 overflow-hidden">
          {showImage ? (
            <img
              src={item.iconUrl ?? ""}
              alt={item.itemName}
              width={36}
              height={36}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Sparkles className="h-4 w-4 text-hud-warn/70" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-hud-warn truncate">{item.itemName}</span>
              {item.inPobPlan && (
                <span className="text-[10px] leading-none font-semibold text-hud-accent border border-hud-accent/40 rounded px-1 py-0.5">
                  {t.pobBadge}
                </span>
              )}
              {item.equipped && (
                <span className="text-[10px] leading-none font-medium text-hud-ok border border-hud-ok/40 rounded px-1 py-0.5">
                  {t.equipped}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-hud-muted tabular-nums">
              <span className="font-sans text-[10px] text-hud-dim">{item.slot}</span>
              <span>·</span>
              <span>{t.lvShort(item.levelReq)}</span>
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-hud-dim" />
              ) : (
                <ChevronRight className="h-3 w-3 text-hud-dim group-hover:text-hud-text" />
              )}
            </div>
          </div>

          <p className={`text-[11px] text-hud-muted leading-snug ${expanded ? "" : "truncate"}`}>{summary}</p>
        </div>
      </button>

      {expanded && (
        <div className="ml-[46px] mt-1 pl-2.5 border-l border-hud-hairline space-y-1 pb-0.5">
          <div className="text-[10px] text-hud-dim">
            {t.basePrefix} <span className="text-hud-text/85">{item.baseType}</span>
          </div>
          {item.keyMods.length > 0 && (
            <ul className="space-y-0.5">
              {item.keyMods.map((mod, idx) => (
                <li key={idx} className="text-[11px] text-hud-text/85 leading-snug">
                  {mod}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
