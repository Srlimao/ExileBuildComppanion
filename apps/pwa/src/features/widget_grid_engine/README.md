# `widget_grid_engine` Domain

Manages per-Context-Mode (`FIELD`, `TOWN`, `LAB`) × per-Device-Form-Factor (`tablet-landscape`, `tablet-portrait`, `phone`) modular widget grids:
- Independent grid arrays per mode so Field Mode prioritizes zone layouts & checklists while Town Mode prioritizes Vendor Shopping, Socket Links, Passive Tree diffs, and Auto-Regex sync.
- React 19 native drag-to-reorder + `1x1` / `2x1` / `2x2` span cycling + `+ Add Widget` drawer (zero legacy `findDOMNode` dependency).
- Syncs changes bi-directionally to Cloudflare Durable Object SQLite + local `localStorage` fallback.
