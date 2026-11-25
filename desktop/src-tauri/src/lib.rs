use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, LogicalSize, Manager, Size, WebviewWindow};

const ALLOWED_KEY_PREFIXES: &[&str] = &["ojousama_", "vn_", "ves_", "combat_", "codex_"];
const MAX_KEY_BYTES: usize = 128;
const MAX_STORE_BYTES: usize = 16 * 1024 * 1024; // 16 MiB per store safety cap

#[derive(Debug, Serialize, Deserialize)]
struct StoreEnvelope {
    key: String,
    value: String,
}

/// Validates a storage key strictly to block any path traversal or illegal filename characters.
pub fn sanitize_store_key(key: &str) -> Result<String, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_KEY_BYTES {
        return Err("invalid store key length".to_string());
    }
    if trimmed.starts_with('.') || trimmed.contains("..") {
        return Err("path traversal segment rejected".to_string());
    }
    if !ALLOWED_KEY_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
    {
        return Err(format!("unmanaged store key prefix: {}", trimmed));
    }
    if !trimmed
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'.')
    {
        return Err("store key contains disallowed characters".to_string());
    }
    Ok(trimmed.to_string())
}

fn resolve_saves_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {}", e))?;
    let dir = base.join("Vesteria").join("saves");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create saves dir: {}", e))?;
    Ok(dir)
}

fn store_file_path(saves_dir: &Path, key: &str) -> Result<(String, PathBuf), String> {
    let safe_key = sanitize_store_key(key)?;
    let filename = format!("{}.json", safe_key);
    let path = saves_dir.join(&filename);
    if path.parent() != Some(saves_dir) {
        return Err("resolved save path escaped saves directory".to_string());
    }
    Ok((safe_key, path))
}

#[tauri::command]
fn indie_read_all_stores(app: AppHandle) -> Result<HashMap<String, String>, String> {
    let saves_dir = resolve_saves_dir(&app)?;
    let mut stores = HashMap::new();

    let entries =
        fs::read_dir(&saves_dir).map_err(|e| format!("failed to list saves dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case("json") {
            continue;
        }
        let stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        if sanitize_store_key(stem).is_err() {
            continue;
        }
        let raw = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };
        if let Ok(env) = serde_json::from_str::<StoreEnvelope>(&raw) {
            if let Ok(valid_key) = sanitize_store_key(&env.key) {
                stores.insert(valid_key, env.value);
                continue;
            }
        }
        stores.insert(stem.to_string(), raw);
    }

    Ok(stores)
}

#[tauri::command]
fn indie_write_store(app: AppHandle, key: String, value: String) -> Result<(), String> {
    if value.len() > MAX_STORE_BYTES {
        return Err("store payload exceeds maximum allowed size".to_string());
    }
    let saves_dir = resolve_saves_dir(&app)?;
    let (safe_key, dest_path) = store_file_path(&saves_dir, &key)?;
    let tmp_path = saves_dir.join(format!("{}.json.tmp", safe_key));

    let envelope = StoreEnvelope {
        key: safe_key,
        value,
    };
    let serialized = serde_json::to_string_pretty(&envelope)
        .map_err(|e| format!("failed to serialize store record: {}", e))?;

    fs::write(&tmp_path, serialized.as_bytes())
        .map_err(|e| format!("failed to write temporary store file: {}", e))?;
    fs::rename(&tmp_path, &dest_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("failed to commit store file: {}", e)
    })?;

    Ok(())
}

#[tauri::command]
fn indie_delete_store(app: AppHandle, key: String) -> Result<(), String> {
    let saves_dir = resolve_saves_dir(&app)?;
    let (_, dest_path) = store_file_path(&saves_dir, &key)?;
    if dest_path.exists() {
        fs::remove_file(&dest_path).map_err(|e| format!("failed to remove store file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn indie_open_saves_dir(app: AppHandle) -> Result<String, String> {
    let saves_dir = resolve_saves_dir(&app)?;
    let dir_str = saves_dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| format!("failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| format!("failed to open Finder: {}", e))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| format!("failed to open file manager: {}", e))?;
    }

    Ok(dir_str)
}

#[tauri::command]
fn indie_toggle_fullscreen(window: WebviewWindow) -> Result<bool, String> {
    let current = window
        .is_fullscreen()
        .map_err(|e| format!("failed to query fullscreen state: {}", e))?;
    let next = !current;
    window
        .set_fullscreen(next)
        .map_err(|e| format!("failed to update fullscreen state: {}", e))?;
    Ok(next)
}

#[tauri::command]
fn indie_set_resolution(window: WebviewWindow, width: u32, height: u32) -> Result<(), String> {
    let w = width.clamp(1024, 7680);
    let h = height.clamp(600, 4320);

    if window.is_fullscreen().unwrap_or(false) {
        let _ = window.set_fullscreen(false);
    }

    window
        .set_size(Size::Logical(LogicalSize::new(w as f64, h as f64)))
        .map_err(|e| format!("failed to set window size: {}", e))?;
    let _ = window.center();
    Ok(())
}

#[tauri::command]
fn indie_exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            indie_read_all_stores,
            indie_write_store,
            indie_delete_store,
            indie_open_saves_dir,
            indie_toggle_fullscreen,
            indie_set_resolution,
            indie_exit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running House of Vesteria desktop application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_valid_managed_keys() {
        assert_eq!(
            sanitize_store_key("ojousama_save_v1").unwrap(),
            "ojousama_save_v1"
        );
        assert_eq!(sanitize_store_key("vn_prefs_v1").unwrap(), "vn_prefs_v1");
        assert_eq!(sanitize_store_key("ves_slot-01").unwrap(), "ves_slot-01");
        assert_eq!(
            sanitize_store_key("combat_arena_v1").unwrap(),
            "combat_arena_v1"
        );
        assert_eq!(
            sanitize_store_key("codex_archive.v1").unwrap(),
            "codex_archive.v1"
        );
    }

    #[test]
    fn rejects_path_traversal_and_unmanaged_keys() {
        assert!(sanitize_store_key("../etc/passwd").is_err());
        assert!(sanitize_store_key("ojousama_../escape").is_err());
        assert!(sanitize_store_key("ojousama_a/b").is_err());
        assert!(sanitize_store_key("ojousama_a\\b").is_err());
        assert!(sanitize_store_key("arbitrary_key").is_err());
        assert!(sanitize_store_key("").is_err());
        assert!(sanitize_store_key(".ojousama_hidden").is_err());
    }
}
