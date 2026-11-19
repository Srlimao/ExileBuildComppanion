# `build_library` Domain

Path of Building–style build & save file manager for the Windows desktop Control Center (`Builds` default first tab).

- **One Save, One Progression:** Each saved build `.json` under `%LOCALAPPDATA%\com.dunhas.exilecompanion\builds\` stores its PoB source/cached XML, selected Passive/Skill/Item sets, custom route, notes, linked character/league, independent `SavedCampaignProgress`, `runElapsedMs`, and `actSplitsMs`.
- **Real Folder Hierarchy:** Folders and subfolders on disk (`build_library_store` in Rust) with traversal/reserved-name guards, Windows case-safe renames, collision auto-numbering, and 1-time migration from legacy `saved_pob_profile.json` + `saved_campaign_progress.json`.
- **Browser Preview Fallback:** `build_library_web_fallback.ts` mirrors the same contract in `localStorage` (`exile_build_library_v1`) when running outside Tauri.
