use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

fn extract_client_tag(line: &str) -> Option<&str> {
    let start = line.find("Client ")?;
    let after = &line[start + "Client ".len()..];
    let digits_len = after.bytes().take_while(|b| b.is_ascii_digit()).count();
    if digits_len == 0 || after.as_bytes().get(digits_len) != Some(&b']') {
        return None;
    }
    Some(&line[start..=start + "Client ".len() + digits_len])
}

fn is_positive_passives_quest_msg(msg: &str) -> bool {
    let Some(inner) = msg.strip_prefix('(').and_then(|s| s.strip_suffix(')')) else {
        return false;
    };
    let Some((count_str, quest_name)) = inner.split_once(" from ") else {
        return false;
    };
    let Ok(count) = count_str.trim().parse::<u32>() else {
        return false;
    };
    count > 0 && !quest_name.trim().is_empty()
}

fn is_positive_passives_bootstrap_line(line: &str, include_level_summary: bool) -> bool {
    let Some(idx) = line.find("] : ") else {
        return false;
    };
    let msg = line[idx + "] : ".len()..].trim();
    if msg.contains("total Ascendancy Skill Point") {
        return true;
    }
    if include_level_summary
        && msg.contains("Passive Skill Point")
        && msg.contains(" from character level")
    {
        return true;
    }
    is_positive_passives_quest_msg(msg)
}

/// Reads the trailing chunk of Client.txt to bootstrap the latest level, zone, and positive /passives completions.
pub fn read_recent_bootstrap_lines(path: &Path, active_pid: Option<u32>, max_bytes: u64) -> Vec<String> {
    if !path.is_file() {
        return Vec::new();
    }
    let Ok(mut file) = File::open(path) else {
        return Vec::new();
    };
    let Ok(meta) = file.metadata() else {
        return Vec::new();
    };
    let file_len = meta.len();
    let start = file_len.saturating_sub(max_bytes);
    if file.seek(SeekFrom::Start(start)).is_err() {
        return Vec::new();
    }

    let mut buf = Vec::with_capacity((file_len - start) as usize);
    if file.read_to_end(&mut buf).is_err() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&buf);
    let aligned = if start > 0 {
        match text.find('\n') {
            Some(pos) => &text[pos + 1..],
            None => return Vec::new(),
        }
    } else {
        text.as_ref()
    };

    let all_lines: Vec<&str> = aligned
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    if all_lines.is_empty() {
        return Vec::new();
    }

    let scoped: Vec<&str> = if let Some(pid) = active_pid {
        let wanted = format!("Client {pid}]");
        let matched: Vec<&str> = all_lines
            .iter()
            .copied()
            .filter(|l| l.contains(&wanted))
            .collect();
        if matched.is_empty() {
            return Vec::new();
        }
        matched
    } else if let Some(last_tag) = all_lines.iter().rev().find_map(|l| extract_client_tag(l)) {
        all_lines
            .iter()
            .copied()
            .filter(|l| l.contains(last_tag))
            .collect()
    } else {
        all_lines
    };

    let last_level_idx = scoped.iter().rposition(|l| l.contains(" is now level "));
    let gen_indices: Vec<usize> = scoped
        .iter()
        .enumerate()
        .filter_map(|(i, l)| l.contains("Generating level ").then_some(i))
        .collect();
    let entered_indices: Vec<usize> = scoped
        .iter()
        .enumerate()
        .filter_map(|(i, l)| l.contains("You have entered ").then_some(i))
        .collect();

    let zone_start_idx = if !gen_indices.is_empty() {
        gen_indices[gen_indices.len().saturating_sub(2)]
    } else if !entered_indices.is_empty() {
        entered_indices[entered_indices.len().saturating_sub(2)]
    } else {
        scoped.len()
    };

    let mut out = Vec::new();
    if let Some(li) = last_level_idx {
        if li < zone_start_idx {
            out.push(scoped[li].to_string());
        }
    }
    for (i, line) in scoped.iter().enumerate().skip(zone_start_idx) {
        if line.contains("Generating level ")
            || line.contains("You have entered ")
            || Some(i) == last_level_idx
        {
            out.push((*line).to_string());
        }
    }

    let last_passives_idx = scoped
        .iter()
        .rposition(|l| l.contains("] : ") && l.contains("total Passive Skill Point"));
    if let Some(p_idx) = last_passives_idx {
        let include_level_summary = !last_level_idx.is_some_and(|li| li > p_idx);
        for line in scoped.iter().skip(p_idx) {
            if is_positive_passives_bootstrap_line(line, include_level_summary) {
                out.push((*line).to_string());
            }
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::read_recent_bootstrap_lines;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn bootstraps_active_pid_zone_and_level_ignoring_older_pids() {
        let mut temp = NamedTempFile::new().expect("temp file");
        writeln!(temp, r#"2026/03/14 10:00:00 10 [DEBUG Client 999] Generating level 68 area "2_10_town" with seed 1"#).unwrap();
        writeln!(temp, r#"2026/11/13 20:06:27 11 [DEBUG Client 18744] Generating level 13 area "1_1_town" with seed 1"#).unwrap();
        writeln!(temp, r#"2026/11/13 20:06:28 12 [INFO Client 18744] : You have entered Lioneye's Watch."#).unwrap();
        writeln!(temp, r#"2026/11/13 20:07:10 13 [INFO Client 18744] : LumiLumiWill (Scion) is now level 12"#).unwrap();
        writeln!(temp, r#"2026/11/13 20:09:18 14 [DEBUG Client 18744] Generating level 10 area "1_1_8" with seed 2509906852"#).unwrap();
        writeln!(temp, r#"2026/11/13 20:09:19 15 [INFO Client 18744] : You have entered Prisoner's Gate."#).unwrap();
        temp.flush().unwrap();

        let boot = read_recent_bootstrap_lines(temp.path(), Some(18744), 256 * 1024);
        assert_eq!(boot.len(), 5);
        assert!(!boot.iter().any(|l| l.contains("Client 999")));
        assert!(boot.last().unwrap().contains("Prisoner's Gate"));
        assert!(boot.iter().any(|l| l.contains("is now level 12")));

        let unknown_pid = read_recent_bootstrap_lines(temp.path(), Some(55555), 256 * 1024);
        assert!(unknown_pid.is_empty());
    }

    #[test]
    fn bootstraps_latest_active_pid_passives_positive_completions_without_reverting_zeros() {
        let mut temp = NamedTempFile::new().expect("temp file");
        writeln!(temp, r#"2026/11/14 20:00:00 10 [INFO Client 999] : 99 total Passive Skill Points (99 allocated)"#).unwrap();
        writeln!(temp, r#"2026/11/14 20:00:00 11 [INFO Client 999] : (1 from Vilenta's Vengeance)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:00:00 12 [DEBUG Client 38840] Generating level 58 area "2_8_town" with seed 1"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:00:01 13 [INFO Client 38840] : You have entered The Sarn Encampment."#).unwrap();
        writeln!(temp, r#"2026/11/14 21:05:00 14 [INFO Client 38840] : 70 total Passive Skill Points (70 allocated)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:05:00 15 [INFO Client 38840] : (1 from Queen of the Sands)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 16 [INFO Client 38840] : 76 total Passive Skill Points (75 allocated)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 17 [INFO Client 38840] : 4 total Ascendancy Skill Points (4 allocated)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 18 [INFO Client 38840] : 59 Passive Skill Points from character level"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 19 [INFO Client 38840] : 17 Passive Skill Points from quests:"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 20 [INFO Client 38840] : (1 from The Dweller of the Deep)"#).unwrap();
        writeln!(temp, r#"2026/11/14 21:10:40 21 [INFO Client 38840] : (0 from An End to Hunger)"#).unwrap();
        temp.flush().unwrap();

        let boot = read_recent_bootstrap_lines(temp.path(), Some(38840), 256 * 1024);
        assert!(boot.iter().any(|l| l.contains("4 total Ascendancy Skill Points")));
        assert!(boot.iter().any(|l| l.contains("59 Passive Skill Points from character level")));
        assert!(boot.iter().any(|l| l.contains("(1 from The Dweller of the Deep)")));
        assert!(!boot.iter().any(|l| l.contains("Client 999")));
        assert!(!boot.iter().any(|l| l.contains("Vilenta's Vengeance")));
        assert!(!boot.iter().any(|l| l.contains("Queen of the Sands")));
        assert!(!boot.iter().any(|l| l.contains("from quests:")));
        assert!(!boot.iter().any(|l| l.contains("(0 from An End to Hunger)")));
    }
}
