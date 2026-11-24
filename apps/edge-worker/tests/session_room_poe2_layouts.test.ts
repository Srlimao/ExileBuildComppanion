import type { WidgetGridItemLayout } from "@exile-hud/core";
import { describe, expect, it } from "vitest";
import {
  containsForbiddenSecret,
  decodeLayoutModeKey,
  encodeLayoutModeKey,
  SessionRoomSqliteRepository,
} from "../src/features/session_room/session_room_sqlite_repository.js";

interface LayoutRow {
  device_form_factor: string;
  mode: string;
  items_json: string;
  updated_at: number;
}

function createInMemorySqlStorage(seedLayouts: LayoutRow[] = []): SqlStorage {
  const layoutRows = new Map<string, LayoutRow>(
    seedLayouts.map((row) => [`${row.device_form_factor}::${row.mode}`, row]),
  );

  const exec = (query: string, ...bindings: unknown[]) => {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith("INSERT INTO ROOM_LAYOUTS")) {
      const [formFactor, modeKey, itemsJson, updatedAt] = bindings as [
        string,
        string,
        string,
        number,
      ];
      layoutRows.set(`${formFactor}::${modeKey}`, {
        device_form_factor: formFactor,
        mode: modeKey,
        items_json: itemsJson,
        updated_at: updatedAt,
      });
      return { toArray: () => [] };
    }
    if (normalized.startsWith("SELECT DEVICE_FORM_FACTOR, MODE, ITEMS_JSON FROM ROOM_LAYOUTS")) {
      return {
        toArray: () =>
          Array.from(layoutRows.values()).map((row) => ({ ...row }) as Record<string, SqlStorageValue>),
      };
    }
    return { toArray: () => [] };
  };

  return { exec } as unknown as SqlStorage;
}

describe("session_room_poe2_layouts", () => {
  it("encodes and decodes per-game layout mode keys while preserving legacy PoE 1 keys", () => {
    expect(encodeLayoutModeKey("FIELD", "poe1")).toBe("FIELD");
    expect(encodeLayoutModeKey("FIELD", "poe2")).toBe("poe2:FIELD");
    expect(encodeLayoutModeKey("TREE", "poe2")).toBe("poe2:TREE");

    expect(decodeLayoutModeKey("FIELD")).toEqual({ gameId: "poe1", mode: "FIELD" });
    expect(decodeLayoutModeKey("poe2:FIELD")).toEqual({ gameId: "poe2", mode: "FIELD" });
    expect(decodeLayoutModeKey("poe2:STANDBY")).toEqual({ gameId: "poe2", mode: "STANDBY" });
    expect(decodeLayoutModeKey("INVALID")).toBeNull();
    expect(decodeLayoutModeKey("poe2:INVALID")).toBeNull();
  });

  it("isolates poe1 and poe2 layouts in room_layouts and keeps legacy rows on poe1", () => {
    const legacyRow: LayoutRow = {
      device_form_factor: "tablet-landscape",
      mode: "TOWN",
      items_json: JSON.stringify([{ widgetId: "vendor_shopping", colSpan: 2, rowSpan: 1, order: 0 }]),
      updated_at: 100,
    };
    const repo = new SessionRoomSqliteRepository(createInMemorySqlStorage([legacyRow]));

    const poe1Field: WidgetGridItemLayout[] = [
      { widgetId: "zone_layout", colSpan: 1, rowSpan: 1, order: 0 },
    ];
    const poe2Field: WidgetGridItemLayout[] = [
      { widgetId: "active_checklist", colSpan: 2, rowSpan: 1, order: 0 },
    ];

    repo.saveLayout("tablet-landscape", "FIELD", poe1Field, "poe1");
    repo.saveLayout("tablet-landscape", "FIELD", poe2Field, "poe2");

    expect(repo.getLayouts("poe1")["tablet-landscape"].TOWN?.[0]?.widgetId).toBe("vendor_shopping");
    expect(repo.getLayouts("poe1")["tablet-landscape"].FIELD).toEqual(poe1Field);
    expect(repo.getLayouts("poe2")["tablet-landscape"].FIELD).toEqual(poe2Field);
    expect(repo.getLayouts("poe2")["tablet-landscape"].TOWN).toBeUndefined();

    const allByGame = repo.getAllLayoutsByGame();
    expect(allByGame.poe1["tablet-landscape"].FIELD).toEqual(poe1Field);
    expect(allByGame.poe2["tablet-landscape"].FIELD).toEqual(poe2Field);
  });

  it("rejects forbidden OAuth token keys while allowing pin and game payloads", () => {
    expect(containsForbiddenSecret('{"access_token":"secret"}')).toBe(true);
    expect(containsForbiddenSecret('{"refresh_token":"secret"}')).toBe(true);
    expect(containsForbiddenSecret('{"client_secret":"secret"}')).toBe(true);
    expect(containsForbiddenSecret('{"code_verifier":"secret"}')).toBe(true);
    expect(containsForbiddenSecret('{"pin":"1234","gameId":"poe2"}')).toBe(false);
  });
});
