use crate::github_release_checker::AppUpdatePhase;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TrayLocale {
    #[default]
    PtBr,
    En,
}

impl TrayLocale {
    pub fn from_code(raw: &str) -> Self {
        if raw.trim().eq_ignore_ascii_case("en") {
            Self::En
        } else {
            Self::PtBr
        }
    }

    pub fn code(self) -> &'static str {
        match self {
            Self::PtBr => "pt-BR",
            Self::En => "en",
        }
    }
}

pub struct TrayMenuLabels {
    pub open_control_center: &'static str,
    pub toggle_overlay: &'static str,
    pub toggle_overlay_lock: &'static str,
    pub force_sync: &'static str,
    pub copy_regex: &'static str,
    pub quit: &'static str,
}

pub fn menu_labels(locale: TrayLocale) -> TrayMenuLabels {
    match locale {
        TrayLocale::PtBr => TrayMenuLabels {
            open_control_center: "Abrir Central de Controle",
            toggle_overlay: "Alternar Overlay no Jogo (F7)",
            toggle_overlay_lock: "Bloquear/Desbloquear Cliques da Overlay (F8)",
            force_sync: "Forçar Sincronização de Personagem",
            copy_regex: "Copiar Regex de Vendor Ativo",
            quit: "Sair do Exile Relay",
        },
        TrayLocale::En => TrayMenuLabels {
            open_control_center: "Open Control Center",
            toggle_overlay: "Toggle In-Game Overlay (F7)",
            toggle_overlay_lock: "Lock/Unlock Overlay Clicks (F8)",
            force_sync: "Force Character Sync",
            copy_regex: "Copy Active Vendor Regex",
            quit: "Quit Exile Relay",
        },
    }
}

pub fn default_standby_tooltip(locale: TrayLocale) -> &'static str {
    match locale {
        TrayLocale::PtBr => "Exile Relay — Em Espera",
        TrayLocale::En => "Exile Relay — Standby",
    }
}

pub fn is_default_standby_tooltip(tooltip: &str) -> bool {
    tooltip == default_standby_tooltip(TrayLocale::PtBr)
        || tooltip == default_standby_tooltip(TrayLocale::En)
}

pub fn update_tooltip_suffix(locale: TrayLocale, tag: &str) -> String {
    match locale {
        TrayLocale::PtBr => format!("[Atualização {tag} Disponível]"),
        TrayLocale::En => format!("[Update {tag} Available]"),
    }
}

pub fn format_update_menu_label(
    locale: TrayLocale,
    phase: &AppUpdatePhase,
    tag: &str,
    progress_percent: Option<u8>,
) -> (String, bool) {
    match (locale, phase) {
        (TrayLocale::PtBr, AppUpdatePhase::Downloading) => (
            format!("Baixando {tag} ({}%)...", progress_percent.unwrap_or(0)),
            false,
        ),
        (TrayLocale::PtBr, AppUpdatePhase::Installing) => {
            (format!("Instalando {tag}..."), false)
        }
        (TrayLocale::PtBr, _) => (format!("Atualizar para {tag} e Reiniciar"), true),
        (TrayLocale::En, AppUpdatePhase::Downloading) => (
            format!("Downloading {tag} ({}%)...", progress_percent.unwrap_or(0)),
            false,
        ),
        (TrayLocale::En, AppUpdatePhase::Installing) => {
            (format!("Installing {tag}..."), false)
        }
        (TrayLocale::En, _) => (format!("Update to {tag} & Restart"), true),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_pt_br_and_parses_en() {
        assert_eq!(TrayLocale::default(), TrayLocale::PtBr);
        assert_eq!(TrayLocale::from_code("en"), TrayLocale::En);
        assert_eq!(TrayLocale::from_code("EN"), TrayLocale::En);
        assert_eq!(TrayLocale::from_code("pt-BR"), TrayLocale::PtBr);
        assert_eq!(TrayLocale::from_code("unknown"), TrayLocale::PtBr);
    }

    #[test]
    fn formats_localized_menu_and_updater_labels() {
        let pt = menu_labels(TrayLocale::PtBr);
        assert_eq!(pt.open_control_center, "Abrir Central de Controle");
        assert_eq!(pt.quit, "Sair do Exile Relay");
        assert_eq!(
            default_standby_tooltip(TrayLocale::PtBr),
            "Exile Relay — Em Espera"
        );
        assert_eq!(
            update_tooltip_suffix(TrayLocale::PtBr, "v0.9.0"),
            "[Atualização v0.9.0 Disponível]"
        );

        let (dl, enabled_dl) = format_update_menu_label(
            TrayLocale::PtBr,
            &AppUpdatePhase::Downloading,
            "v0.9.0",
            Some(42),
        );
        assert_eq!(dl, "Baixando v0.9.0 (42%)...");
        assert!(!enabled_dl);

        let (ready_en, enabled_en) = format_update_menu_label(
            TrayLocale::En,
            &AppUpdatePhase::Available,
            "v0.9.0",
            None,
        );
        assert_eq!(ready_en, "Update to v0.9.0 & Restart");
        assert!(enabled_en);
    }
}
