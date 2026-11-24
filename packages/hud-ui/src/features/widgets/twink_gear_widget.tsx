import { buildTwinkGearTimeline, type HudSessionSnapshot, type TwinkBracketId } from "@exile-hud/core";
import { getGameAdapter, type TwinkArchetypeId } from "@exile-hud/game-data";
import { Check, ClipboardCopy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHudI18n } from "../i18n/hud_i18n_provider.js";
import { TwinkGearItemRow } from "./twink_gear_item_row.js";

const ARCHETYPE_OPTIONS: readonly TwinkArchetypeId[] = ["spell", "bow", "melee", "minion", "hollow_palm"];

interface TwinkGearWidgetProps {
  snapshot: HudSessionSnapshot;
  onPushToPcClipboard?: (regex: string) => void;
}

/** Displays class/level/archetype-aware PoE1 twink uniques with official art and stash regex copy. */
export function TwinkGearWidget({ snapshot, onPushToPcClipboard }: TwinkGearWidgetProps) {
  const { msg } = useHudI18n();
  const t = msg.widgets.twinkGear;
  const [archetypeOverride, setArchetypeOverride] = useState<TwinkArchetypeId | null>(null);
  const [copied, setCopied] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bracketRefs = useRef<Partial<Record<TwinkBracketId, HTMLElement | null>>>({});

  const adapter = getGameAdapter(snapshot.gameId);
  const timeline = useMemo(
    () =>
      buildTwinkGearTimeline({
        snapshot,
        adapter,
        archetypeOverride,
      }),
    [snapshot, adapter, archetypeOverride],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    const targetEl = bracketRefs.current[timeline.activeBracketId];
    if (!container || !targetEl || typeof container.scrollTo !== "function") return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const nextTop = Math.max(0, container.scrollTop + (targetRect.top - containerRect.top) - 4);
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: nextTop, behavior: prefersReduced ? "auto" : "smooth" });
  }, [timeline.activeBracketId, archetypeOverride]);

  const handleCopyRegex = async () => {
    if (!timeline.stashRegex) return;
    onPushToPcClipboard?.(timeline.stashRegex);
    try {
      await navigator.clipboard?.writeText(timeline.stashRegex);
    } catch {
      // Clipboard blocked on non-focus; PC push still fires
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const charLevel = Math.max(1, snapshot.characterLevel);

  return (
    <div className="flex flex-col h-full gap-2 min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-hud-muted">{t.title}</h2>
          <span className="text-[11px] font-mono text-hud-dim tabular-nums truncate">
            {snapshot.characterClass} · {t.lvShort(charLevel)} ·{" "}
            {t.itemsCount(timeline.equippedCount, timeline.totalRecommendedCount)}
          </span>
        </div>

        <button
          type="button"
          disabled={!timeline.stashRegex}
          onClick={() => void handleCopyRegex()}
          title={timeline.stashRegex || undefined}
          className="px-2.5 py-1.5 rounded-lg bg-hud-subtle hover:bg-hud-subtle/80 disabled:opacity-40 text-[11px] font-medium text-hud-text inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-hud-ok" /> : <ClipboardCopy className="h-3 w-3 text-hud-accent" />}
          <span>{copied ? t.copiedRegex : t.copyStashRegex}</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
        <button
          type="button"
          aria-pressed={archetypeOverride === null}
          onClick={() => setArchetypeOverride(null)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
            archetypeOverride === null
              ? "border-hud-accent bg-hud-accent/15 text-hud-text font-semibold"
              : "border-hud-hairline text-hud-muted hover:text-hud-text"
          }`}
        >
          {t.autoLabel(t.archetypes[timeline.detectedArchetype])}
        </button>

        {ARCHETYPE_OPTIONS.map((arch) => {
          const selected = archetypeOverride === arch;
          return (
            <button
              key={arch}
              type="button"
              aria-pressed={selected}
              onClick={() => setArchetypeOverride(arch)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
                selected
                  ? "border-hud-accent bg-hud-accent/15 text-hud-text font-semibold"
                  : "border-hud-hairline text-hud-muted hover:text-hud-text"
              }`}
            >
              {t.archetypes[arch]}
            </button>
          );
        })}
      </div>

      {timeline.effectiveArchetype === "hollow_palm" && (
        <p className="text-[11px] text-hud-accent/90 leading-snug shrink-0">{t.hollowPalmNotice}</p>
      )}

      <div ref={scrollContainerRef} className="relative flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        {timeline.brackets.length === 0 ? (
          <p className="text-xs text-hud-muted py-2">{t.noItems}</p>
        ) : (
          timeline.brackets.map((bracket) => {
            const isActive = bracket.id === timeline.activeBracketId;
            const isEarlier = !isActive && bracket.maxLevel < charLevel;
            const statusLabel = isActive ? t.currentBracket : isEarlier ? t.earlierBracket : t.upcomingBracket;

            return (
              <section
                key={bracket.id}
                ref={(el) => {
                  bracketRefs.current[bracket.id] = el;
                }}
                className={`space-y-1 ${
                  isActive
                    ? "border-l-2 border-hud-accent pl-2"
                    : isEarlier
                      ? "opacity-75"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-hud-hairline">
                  <span className="text-[11px] font-mono font-semibold text-hud-text">{bracket.label}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-hud-accent/20 text-hud-accent"
                        : isEarlier
                          ? "text-hud-dim"
                          : "text-hud-muted"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div className="divide-y divide-hud-hairline/70">
                  {bracket.items.map((item) => (
                    <TwinkGearItemRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
