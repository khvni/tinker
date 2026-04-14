mod commands;

use std::{
  net::TcpListener,
  path::PathBuf,
  sync::Mutex,
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use tauri::{Manager, RunEvent, State};
use tauri_plugin_shell::{
  process::{CommandChild, CommandEvent},
  ShellExt,
};
use tokio::time::sleep;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OpencodeConnection {
  base_url: String,
  username: String,
  password: String,
}

#[derive(Default)]
struct OpencodeState {
  child: Mutex<Option<CommandChild>>,
  connection: Mutex<Option<OpencodeConnection>>,
}

#[tauri::command]
fn get_opencode_connection(state: State<'_, OpencodeState>) -> Result<OpencodeConnection, String> {
  state
    .connection
    .lock()
    .map_err(|_| "OpenCode connection state lock was poisoned.".to_string())?
    .clone()
    .ok_or_else(|| "OpenCode is not running yet.".to_string())
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
}

fn reserve_opencode_port() -> Result<u16, String> {
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
  let port = listener.local_addr().map_err(|error| error.to_string())?.port();
  drop(listener);
  Ok(port)
}

fn opencode_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../opencode.json");
    if dev_path.exists() {
      return dev_path.canonicalize().map_err(|error| error.to_string());
    }
  }

  let bundled_path = app
    .path()
    .resource_dir()
    .map_err(|error| error.to_string())?
    .join("opencode.json");

  if bundled_path.exists() {
    return Ok(bundled_path);
  }

  Err("Could not locate the bundled opencode.json configuration.".to_string())
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

async fn wait_for_opencode(connection: &OpencodeConnection) -> Result<(), String> {
  let client = reqwest::Client::new();
  let health_url = format!("{}/global/health", connection.base_url);

  for _attempt in 0..20 {
    match client
      .get(&health_url)
      .basic_auth(&connection.username, Some(&connection.password))
      .send()
      .await
    {
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

  let config_path = opencode_config_path(app)?;
  let working_dir = config_path
    .parent()
    .ok_or_else(|| "OpenCode config path did not have a parent directory.".to_string())?
    .to_path_buf();
  let port = reserve_opencode_port()?;
  let connection = OpencodeConnection {
    base_url: format!("http://127.0.0.1:{port}"),
    username: format!("tinker-{}", random_url_safe(8)),
    password: random_url_safe(24),
  };

  let sidecar = app
    .shell()
    .sidecar("opencode")
    .map_err(|error| error.to_string())?
    .args(["serve", "--hostname", "127.0.0.1", "--port", &port.to_string()])
    .envs([
      ("OPENCODE_CONFIG", config_path.to_string_lossy().into_owned()),
      ("OPENCODE_SERVER_USERNAME", connection.username.clone()),
      ("OPENCODE_SERVER_PASSWORD", connection.password.clone()),
    ])
    .current_dir(working_dir);

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

  if let Err(error) = wait_for_opencode(&connection).await {
    stop_opencode(app);
    return Err(error);
  }

  {
    let mut guard = state
      .connection
      .lock()
      .map_err(|_| "OpenCode connection state lock was poisoned.".to_string())?;
    *guard = Some(connection);
  }

  Ok(())
}

fn stop_opencode(app: &tauri::AppHandle) {
  let child = {
    let state = app.state::<OpencodeState>();

    if let Ok(mut guard) = state.connection.lock() {
      *guard = None;
    }

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
    .invoke_handler(tauri::generate_handler![get_opencode_connection, commands::oauth::oauth_flow])
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
