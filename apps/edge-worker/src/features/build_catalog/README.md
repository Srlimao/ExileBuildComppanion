# `build_catalog` Domain

Aggregates, normalizes, and serves PoE 1 & PoE 2 build guides from verified public sources stored in Cloudflare D1 (`general-db` -> `exile_build_catalog`, `exile_catalog_sync_state`).

- **Sources:** Maxroll (`maxroll.gg/poe/build-guides`, `/poe2/build-guides`, and `planners.maxroll.gg` PoB JSON), PoEBuilds.cc (`/`, `/poe1/<class>`, `/poe2`), and Official PoE 1 Class Forums (current-patch threads containing verified `pobb.in` links).
- **Dynamic Cron Cadence:** Daily trigger (`0 6 * * *`) checks GGG `/leagues` `startAt`, admin overrides, and newly detected patch versions—running every **48h** during `[startAt - 7d, startAt + 30d]` (or patch surge) and cooling off to **7d** otherwise.
- **Security:** `/api/builds/resolve-pob` strictly allowlists `maxroll.gg/poe/pob/*` and `pobb.in/*` (no arbitrary SSRF). Admin routes (`POST /api/builds/sync`, `PUT /api/builds/league-window`) require `CATALOG_ADMIN_KEY` Bearer auth and fail closed (`503`) if unset.
