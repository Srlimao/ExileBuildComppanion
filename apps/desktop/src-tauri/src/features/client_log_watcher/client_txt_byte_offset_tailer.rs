use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

/// Incremental byte-offset reader for PoE's append-only Client.txt with truncation recovery.
#[derive(Debug, Default)]
pub struct ByteOffsetTailer {
    path: Option<PathBuf>,
    offset: u64,
    partial_line: String,
}

impl ByteOffsetTailer {
    pub fn set_path(&mut self, new_path: Option<PathBuf>, jump_to_end: bool) {
        if self.path == new_path {
            return;
        }
        self.partial_line.clear();
        self.offset = if jump_to_end {
            new_path
                .as_ref()
                .and_then(|p| fs::metadata(p).ok())
                .map(|m| m.len())
                .unwrap_or(0)
        } else {
            0
        };
        self.path = new_path;
    }

    pub fn current_path(&self) -> Option<&PathBuf> {
        self.path.as_ref()
    }

    pub fn poll_new_lines(&mut self) -> Result<Vec<String>, String> {
        let Some(path) = self.path.as_ref() else {
            return Ok(Vec::new());
        };
        if !path.is_file() {
            return Ok(Vec::new());
        }

        let meta = fs::metadata(path).map_err(|e| format!("Failed to stat Client.txt: {e}"))?;
        let file_len = meta.len();

        if file_len < self.offset {
            self.offset = 0;
            self.partial_line.clear();
        }
        if file_len == self.offset {
            return Ok(Vec::new());
        }

        let mut file = File::open(path).map_err(|e| format!("Failed to open Client.txt: {e}"))?;
        file.seek(SeekFrom::Start(self.offset))
            .map_err(|e| format!("Failed to seek Client.txt: {e}"))?;

        let to_read = (file_len - self.offset).min(2 * 1024 * 1024) as usize;
        let mut buf = vec![0u8; to_read];
        let bytes_read = file
            .read(&mut buf)
            .map_err(|e| format!("Failed to read Client.txt: {e}"))?;
        buf.truncate(bytes_read);
        self.offset += bytes_read as u64;

        let chunk = String::from_utf8_lossy(&buf);
        self.partial_line.push_str(&chunk);

        let mut lines = Vec::new();
        while let Some(newline_pos) = self.partial_line.find('\n') {
            let line = self.partial_line[..newline_pos].trim_end_matches('\r').to_string();
            self.partial_line.drain(..=newline_pos);
            if !line.is_empty() {
                lines.push(line);
            }
        }

        Ok(lines)
    }
}

fn extract_client_tag(line: &str) -> Option<&str> {
    let start = line.find("Client ")?;
    let after = &line[start + "Client ".len()..];
    let digits_len = after.bytes().take_while(|b| b.is_ascii_digit()).count();
    if digits_len == 0 || after.as_bytes().get(digits_len) != Some(&b']') {
        return None;
    }
    Some(&line[start..=start + "Client ".len() + digits_len])
}

/// Reads the trailing chunk of Client.txt to bootstrap the latest level and zone when attaching mid-session.
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
    out
}

#[cfg(test)]
mod tests {
    use super::{read_recent_bootstrap_lines, ByteOffsetTailer};
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn tails_incrementally_handles_partial_lines_and_truncation() {
        let mut temp = NamedTempFile::new().expect("temp file");
        writeln!(temp, "2026/11/13 [INFO Client 1] Existing old log line").unwrap();
        temp.flush().unwrap();

        let mut tailer = ByteOffsetTailer::default();
        tailer.set_path(Some(temp.path().to_path_buf()), true);
        assert!(tailer.poll_new_lines().unwrap().is_empty());

        // Write partial line without trailing newline
        write!(temp, "2026/11/13 [INFO Client 1] Generating level 2").unwrap();
        temp.flush().unwrap();
        assert!(tailer.poll_new_lines().unwrap().is_empty());

        // Complete the line + add another
        writeln!(temp, " area \"1_1_2\" with seed 777").unwrap();
        writeln!(temp, "2026/11/13 [INFO Client 1] : Hero has been slain.").unwrap();
        temp.flush().unwrap();

        let lines = tailer.poll_new_lines().unwrap();
        assert_eq!(lines.len(), 2);
        assert!(lines[0].contains("Generating level 2 area \"1_1_2\""));
        assert!(lines[1].contains("Hero has been slain."));

        // Truncate/rotate file smaller than previous offset
        temp.as_file().set_len(0).unwrap();
        let mut rotated = std::fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(temp.path())
            .unwrap();
        writeln!(rotated, "2026/11/13 [INFO Client 1] You have entered Lioneye's Watch.").unwrap();
        rotated.flush().unwrap();

        let after_truncate = tailer.poll_new_lines().unwrap();
        assert_eq!(after_truncate, vec!["2026/11/13 [INFO Client 1] You have entered Lioneye's Watch."]);
    }

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
}
