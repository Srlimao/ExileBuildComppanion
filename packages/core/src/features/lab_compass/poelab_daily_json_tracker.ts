import type { LabTelemetry } from "../protocol/session_room_wire_protocol.js";

interface RawPoelabRoom {
  id?: string | number;
  name?: string;
  exits?: Record<string, string | number> | string[];
  contents?: string[];
  secret_passage?: boolean;
  darkshrines?: number;
}

export function parsePoelabDailyJson(rawJson: string): LabTelemetry {
  const parsed = JSON.parse(rawJson) as Record<string, any>;
  const rawRooms: RawPoelabRoom[] = Array.isArray(parsed.rooms)
    ? parsed.rooms
    : Array.isArray(parsed)
      ? (parsed as RawPoelabRoom[])
      : [];

  if (rawRooms.length === 0) {
    throw new Error("PoELab JSON contains no rooms array.");
  }

  const rooms = rawRooms.map((room, idx) => {
    const exits = Array.isArray(room.exits)
      ? room.exits.map(String)
      : room.exits && typeof room.exits === "object"
        ? Object.values(room.exits).map(String)
        : [];
    const contents = Array.isArray(room.contents) ? room.contents.map((c) => c.toLowerCase()) : [];
    const hasGoldenDoor = contents.some((c) => c.includes("golden-door") || c.includes("golden door"));
    const darkshrines =
      typeof room.darkshrines === "number"
        ? room.darkshrines
        : contents.filter((c) => c.includes("darkshrine")).length;

    return {
      id: String(room.id ?? idx + 1),
      name: String(room.name ?? `Room ${idx + 1}`),
      exits,
      hasGoldenDoor,
      darkshrines,
    };
  });

  const difficultyLabel = String(parsed.difficulty ?? parsed.labDifficulty ?? "Daily Labyrinth");
  return {
    hasDailyLayout: true,
    difficultyLabel,
    currentRoomId: rooms[0]?.id ?? null,
    currentRoomName: rooms[0]?.name ?? null,
    rooms,
    completedTrialAreaIds: [],
  };
}

export function advanceLabRoomBySeed(
  lab: LabTelemetry,
  areaId: string,
  areaSeed: string | null,
  seedHistory: Map<string, string>,
): LabTelemetry {
  if (!lab.hasDailyLayout || lab.rooms.length === 0) return lab;
  if (/airlock/i.test(areaId)) {
    return {
      ...lab,
      currentRoomId: lab.rooms[0]?.id ?? null,
      currentRoomName: lab.rooms[0]?.name ?? null,
    };
  }
  if (!areaSeed) return lab;

  const existing = seedHistory.get(areaSeed);
  if (existing) {
    const matched = lab.rooms.find((r) => r.id === existing);
    if (matched) return { ...lab, currentRoomId: matched.id, currentRoomName: matched.name };
  }

  const currentIndex = Math.max(0, lab.rooms.findIndex((r) => r.id === lab.currentRoomId));
  const nextRoom = lab.rooms[Math.min(lab.rooms.length - 1, currentIndex + 1)];
  if (!nextRoom) return lab;

  seedHistory.set(areaSeed, nextRoom.id);
  return {
    ...lab,
    currentRoomId: nextRoom.id,
    currentRoomName: nextRoom.name,
  };
}
