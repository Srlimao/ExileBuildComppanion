import type {
  DeviceFormFactor,
  HudContextMode,
  HudSessionSnapshot,
  ModeWidgetGrids,
  ViewerToRoomMessage,
  WidgetGridItemLayout,
} from "@exile-hud/core";

export interface RoomMetaRecord {
  room_id: string;
  host_secret: string;
  pin: string;
  created_at: number;
  updated_at: number;
}

export interface RegisterRoomInput {
  roomId: string;
  hostSecret: string;
  pin: string;
  snapshot: HudSessionSnapshot;
}

export function containsForbiddenSecret(raw: string): boolean {
  return /poesessid/i.test(raw);
}

/** Wraps Cloudflare Durable Object SQLite storage for one paired companion room. */
export class SessionRoomSqliteRepository {
  constructor(private readonly sql: SqlStorage) {
    this.initSchema();
  }

  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        room_id TEXT NOT NULL,
        host_secret TEXT NOT NULL,
        pin TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_layouts (
        device_form_factor TEXT NOT NULL,
        mode TEXT NOT NULL,
        items_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (device_form_factor, mode)
      );
    `);
  }

  getRoomMeta(): RoomMetaRecord | null {
    const rows = this.sql
      .exec("SELECT room_id, host_secret, pin, created_at, updated_at FROM room_meta WHERE id = 1")
      .toArray();
    const row = rows[0];
    if (!row) return null;
    return {
      room_id: String(row.room_id),
      host_secret: String(row.host_secret),
      pin: String(row.pin),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };
  }

  registerOrUpdateRoom(input: RegisterRoomInput): { ok: true } | { ok: false; status: number; error: string } {
    const now = Date.now();
    const existing = this.getRoomMeta();
    if (existing && existing.host_secret !== input.hostSecret) {
      return { ok: false, status: 403, error: "Room is already registered to another host secret." };
    }

    const createdAt = existing?.created_at ?? now;
    this.sql.exec(
      `INSERT INTO room_meta (id, room_id, host_secret, pin, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         room_id = excluded.room_id,
         host_secret = excluded.host_secret,
         pin = excluded.pin,
         updated_at = excluded.updated_at`,
      input.roomId,
      input.hostSecret,
      input.pin,
      createdAt,
      now,
    );

    this.saveSnapshot(input.snapshot);
    return { ok: true };
  }

  getSnapshot(): HudSessionSnapshot | null {
    const rows = this.sql.exec("SELECT payload_json FROM room_snapshot WHERE id = 1").toArray();
    const row = rows[0];
    if (!row || typeof row.payload_json !== "string") return null;
    try {
      return JSON.parse(row.payload_json) as HudSessionSnapshot;
    } catch {
      return null;
    }
  }

  saveSnapshot(snapshot: HudSessionSnapshot): void {
    const now = Date.now();
    const encoded = JSON.stringify(snapshot);
    this.sql.exec(
      `INSERT INTO room_snapshot (id, payload_json, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      encoded,
      now,
    );
  }

  applyViewerToggleToSnapshot(command: ViewerToRoomMessage): HudSessionSnapshot | null {
    if (command.type !== "viewer:toggle_checkpoint" && command.type !== "viewer:toggle_gem") {
      return null;
    }
    const snapshot = this.getSnapshot();
    if (!snapshot) return null;

    if (command.type === "viewer:toggle_checkpoint") {
      const nextCheckpoints = snapshot.checkpoints.map((cp) =>
        cp.id === command.checkpointId ? { ...cp, completed: command.completed ?? !cp.completed } : cp,
      );
      const updated = { ...snapshot, version: snapshot.version + 1, checkpoints: nextCheckpoints };
      this.saveSnapshot(updated);
      return updated;
    }

    const nextGems = snapshot.gemSteps.map((gem) =>
      gem.id === command.gemStepId ? { ...gem, manualCompleted: command.completed ?? !gem.manualCompleted } : gem,
    );
    const updated = { ...snapshot, version: snapshot.version + 1, gemSteps: nextGems };
    this.saveSnapshot(updated);
    return updated;
  }

  getLayouts(): ModeWidgetGrids {
    const grids: ModeWidgetGrids = {
      "tablet-landscape": {},
      "tablet-portrait": {},
      phone: {},
    };
    const rows = this.sql.exec("SELECT device_form_factor, mode, items_json FROM room_layouts").toArray();
    for (const row of rows) {
      const ff = String(row.device_form_factor) as DeviceFormFactor;
      const mode = String(row.mode) as HudContextMode;
      if (!(ff in grids)) continue;
      try {
        grids[ff][mode] = JSON.parse(String(row.items_json)) as WidgetGridItemLayout[];
      } catch {
        // Ignore corrupted layout record
      }
    }
    return grids;
  }

  saveLayout(formFactor: DeviceFormFactor, mode: HudContextMode, items: WidgetGridItemLayout[]): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO room_layouts (device_form_factor, mode, items_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(device_form_factor, mode) DO UPDATE SET
         items_json = excluded.items_json,
         updated_at = excluded.updated_at`,
      formFactor,
      mode,
      JSON.stringify(items),
      now,
    );
  }
}
