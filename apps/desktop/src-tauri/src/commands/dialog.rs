use std::sync::mpsc;

use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_folder_picker<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
  // The native folder picker must run on the OS UI thread. Using the blocking
  // variant from an async command blocks that same thread — the dialog can
  // never draw and the app appears frozen. Use the callback API and bridge to
  // async via a oneshot mpsc channel instead.
  let (tx, rx) = mpsc::channel();
  app.dialog().file().pick_folder(move |path| {
    let _ = tx.send(path);
  });

  let picked = tauri::async_runtime::spawn_blocking(move || rx.recv())
    .await
    .map_err(|error| format!("Folder picker task join failed: {error}"))?
    .map_err(|error| format!("Folder picker channel closed: {error}"))?
    .ok_or_else(|| "Folder selection was cancelled.".to_string())?;

  let path = picked
    .into_path()
    .map_err(|error| format!("Picked folder is not a local filesystem path: {error}"))?;
  Ok(path.to_string_lossy().into_owned())
}
