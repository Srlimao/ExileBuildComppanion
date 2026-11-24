use std::path::{Path, PathBuf};

use crate::poe_process_heartbeat::PoeGameKind;

pub const REGULAR_FILTER_FILE_NAME: &str = "ExileHUD_LeagueStart_Regular.filter";
pub const SEMI_STRICT_FILTER_FILE_NAME: &str = "ExileHUD_LeagueStart_SemiStrict.filter";
pub const POE2_REGULAR_FILTER_FILE_NAME: &str = "ExileHUD_PoE2_LeagueStart_Regular.filter";
pub const POE2_SEMI_STRICT_FILTER_FILE_NAME: &str = "ExileHUD_PoE2_LeagueStart_SemiStrict.filter";

const REGULAR_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe1/filters/ExileHUD_LeagueStart_Regular.filter"
);
const SEMI_STRICT_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe1/filters/ExileHUD_LeagueStart_SemiStrict.filter"
);
const POE2_REGULAR_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe2/filters/ExileHUD_PoE2_LeagueStart_Regular.filter"
);
const POE2_SEMI_STRICT_FILTER_CONTENT: &str = include_str!(
    "../../../../../../packages/game-data/data/poe2/filters/ExileHUD_PoE2_LeagueStart_SemiStrict.filter"
);

#[derive(Debug, Clone, Copy)]
pub struct BakedFilterPreset {
    pub id: &'static str,
    pub file_name: &'static str,
    pub content: &'static str,
}

pub const POE1_BAKED_PRESETS: [BakedFilterPreset; 2] = [
    BakedFilterPreset {
        id: "regular",
        file_name: REGULAR_FILTER_FILE_NAME,
        content: REGULAR_FILTER_CONTENT,
    },
    BakedFilterPreset {
        id: "semi_strict",
        file_name: SEMI_STRICT_FILTER_FILE_NAME,
        content: SEMI_STRICT_FILTER_CONTENT,
    },
];

pub const POE2_BAKED_PRESETS: [BakedFilterPreset; 2] = [
    BakedFilterPreset {
        id: "regular",
        file_name: POE2_REGULAR_FILTER_FILE_NAME,
        content: POE2_REGULAR_FILTER_CONTENT,
    },
    BakedFilterPreset {
        id: "semi_strict",
        file_name: POE2_SEMI_STRICT_FILTER_FILE_NAME,
        content: POE2_SEMI_STRICT_FILTER_CONTENT,
    },
];

pub fn baked_presets_for_game(game: PoeGameKind) -> &'static [BakedFilterPreset] {
    match game {
        PoeGameKind::Poe1 => &POE1_BAKED_PRESETS,
        PoeGameKind::Poe2 => &POE2_BAKED_PRESETS,
    }
}

pub fn poe_filter_subpath(documents_root: &Path, game: PoeGameKind) -> PathBuf {
    let game_dir = match game {
        PoeGameKind::Poe1 => "Path of Exile",
        PoeGameKind::Poe2 => "Path of Exile 2",
    };
    documents_root.join("My Games").join(game_dir)
}
