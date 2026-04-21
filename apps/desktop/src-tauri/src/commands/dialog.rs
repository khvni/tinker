use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn open_folder_picker<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
  let picked = app
    .dialog()
    .file()
    .blocking_pick_folder()
    .ok_or_else(|| "Folder selection was cancelled.".to_string())?;
  let path = picked
    .into_path()
    .map_err(|error| format!("Picked folder is not a local filesystem path: {error}"))?;
  Ok(path.to_string_lossy().into_owned())
}
