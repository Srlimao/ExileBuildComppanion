# SessionRoom Feature (`session_room`)

Hibernating WebSocket relay and SQLite persistence unit for one active PC-to-Companion HUD pairing room (`SESSION_ROOMS` Durable Object binding).

## Storage Tables (`ctx.storage.sql`)
- `room_meta` (`id = 1`): stores `room_id`, `host_secret`, `pin`, and timestamps.
- `room_snapshot` (`id = 1`): latest serialized `HudSessionSnapshot` pushed by the PC Tauri host.
- `room_layouts`: per-device-form-factor (`tablet-landscape`, `tablet-portrait`, `phone`) and per-mode (`FIELD`, `TOWN`, `LAB`, `STANDBY`) customizable widget grid JSON.

## WebSocket Authentication & Close Codes
- `4001`: Room has not been registered yet by a PC host (`POST /api/session/:roomId/register`).
- `4003`: Invalid `pin` (for `role=viewer`) or invalid `secret` (for `role=host`).
- `1008`: Payload rejected by security policy (`POESESSID` / `poesessid` strings are strictly rejected at the edge and must remain inside Windows Credential Manager on the PC).
