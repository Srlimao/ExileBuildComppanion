use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;

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

#[cfg(test)]
mod tests {
    use super::ByteOffsetTailer;
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
}
