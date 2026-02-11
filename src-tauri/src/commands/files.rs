use std::path::Path;
use walkdir::WalkDir;

use crate::models::DirectoryFileEntry;

#[tauri::command]
pub fn list_directory_files(path: String) -> Result<Vec<DirectoryFileEntry>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let abs = entry.path().to_string_lossy().to_string();
            let rel = entry
                .path()
                .strip_prefix(root)
                .unwrap_or(entry.path())
                .to_string_lossy()
                .to_string();
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            entries.push(DirectoryFileEntry {
                absolute_path: abs,
                relative_path: rel,
                size,
            });
        }
    }

    entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(entries)
}
