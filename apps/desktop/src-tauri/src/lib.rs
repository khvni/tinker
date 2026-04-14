mod commands;

use std::sync::Mutex;

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{
  process::{CommandChild, CommandEvent},
  ShellExt,
};
use tokio::time::sleep;

const OPENCODE_PORT: u16 = 19_918;
const OPENCODE_URL: &str = "http://127.0.0.1:19918";
const OPENCODE_HEALTH_URL: &str = "http://127.0.0.1:19918/health";

#[derive(Default)]
struct OpencodeState {
  child: Mutex<Option<CommandChild>>,
}

#[tauri::command]
fn get_opencode_url() -> String {
  OPENCODE_URL.to_string()
}

fn main_window_config(app: &tauri::AppHandle) -> Result<&tauri::utils::config::WindowConfig, String> {
  app
    .config()
    .app
    .windows
    .iter()
    .find(|window| window.label == "main")
    .ok_or_else(|| "Missing main window configuration.".to_string())
}

fn ensure_main_window(app: &tauri::AppHandle) -> Result<(), String> {
  if app.get_webview_window("main").is_some() {
    return Ok(());
  }

  tauri::WebviewWindowBuilder::from_config(app, main_window_config(app).map_err(|error| error.to_string())?)
    .map_err(|error| error.to_string())?
    .build()
    .map_err(|error| error.to_string())?;

  Ok(())
}

async fn wait_for_opencode() -> Result<(), String> {
  let client = reqwest::Client::new();

  for _attempt in 0..20 {
    match client.get(OPENCODE_HEALTH_URL).send().await {
      Ok(response) if response.status().is_success() => return Ok(()),
      _ => sleep(std::time::Duration::from_millis(500)).await,
    }
  }

  Err("Timed out waiting for OpenCode to become healthy.".to_string())
}

async fn start_opencode(app: &tauri::AppHandle) -> Result<(), String> {
  let state = app.state::<OpencodeState>();
  if state.child.lock().map_err(|_| "OpenCode state lock was poisoned.".to_string())?.is_some() {
    return Ok(());
  }

  let sidecar = app
    .shell()
    .sidecar("opencode")
    .map_err(|error| error.to_string())?
    .args(["serve", "--port", &OPENCODE_PORT.to_string()]);

  let (mut receiver, child) = sidecar.spawn().map_err(|error| error.to_string())?;

  {
    let mut guard = state
      .child
      .lock()
      .map_err(|_| "OpenCode state lock was poisoned.".to_string())?;
    *guard = Some(child);
  }

  tauri::async_runtime::spawn(async move {
    while let Some(event) = receiver.recv().await {
      match event {
        CommandEvent::Stdout(line) => {
          eprintln!("[opencode] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Stderr(line) => {
          eprintln!("[opencode:error] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Error(error) => {
          eprintln!("[opencode:error] {error}");
        }
        CommandEvent::Terminated(payload) => {
          eprintln!(
            "[opencode] exited with code {:?} and signal {:?}",
            payload.code, payload.signal
          );
        }
        _ => {}
      }
    }
  });

  wait_for_opencode().await
}

fn stop_opencode(app: &tauri::AppHandle) {
  let child = {
    let state = app.state::<OpencodeState>();
    let next_child = match state.child.lock() {
      Ok(mut guard) => guard.take(),
      Err(_) => None,
    };

    next_child
  };

  if let Some(child) = child {
    let _ = child.kill();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_keyring::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .manage(OpencodeState::default())
    .invoke_handler(tauri::generate_handler![
      get_opencode_url,
      commands::codex_oauth::codex_oauth_flow,
      commands::oauth::oauth_flow
    ])
    .setup(|app| {
      tauri::async_runtime::block_on(async {
        start_opencode(&app.handle()).await?;
        ensure_main_window(&app.handle())?;
        Ok::<(), String>(())
      })
      .map_err(Into::into)
    })
    .build(tauri::generate_context!())
    .expect("error while running Tinker");

  let handle = app.handle().clone();
  app.run(move |_app, event| {
    if matches!(event, RunEvent::Exit) {
      stop_opencode(&handle);
    }
  });
}
