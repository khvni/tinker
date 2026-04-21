mod commands;

use std::{path::PathBuf, sync::Mutex};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use tauri::async_runtime::Receiver;
use tauri::{Manager, RunEvent, State};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_shell::{
  process::{CommandChild, CommandEvent},
  ShellExt,
};
use tokio::time::{sleep, timeout, Duration as TokioDuration, Instant};

use crate::commands::auth::{AuthProvider, BetterAuthState, SSOSession, KEYRING_SERVICE};

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

fn clone_opencode_connection(state: &OpencodeState) -> Result<OpencodeConnection, String> {
  state
    .connection
    .lock()
    .map_err(|_| "OpenCode connection state lock was poisoned.".to_string())?
    .clone()
    .ok_or_else(|| "OpenCode is not running yet.".to_string())
}

fn read_keychain_session(app: &tauri::AppHandle, provider: AuthProvider) -> Result<Option<SSOSession>, String> {
  let account = match provider {
    AuthProvider::Google => crate::commands::auth::GOOGLE_SESSION_ACCOUNT,
    AuthProvider::Github => crate::commands::auth::GITHUB_SESSION_ACCOUNT,
  };

  let raw = app
    .keyring()
    .get_password(KEYRING_SERVICE, account)
    .map_err(|error| format!("Keychain operation failed: {error}"))?;

  let Some(raw) = raw else {
    return Ok(None);
  };

  match serde_json::from_str(&raw) {
    Ok(session) => Ok(Some(session)),
    Err(error) => {
      let _ = app.keyring().delete_password(KEYRING_SERVICE, account);
      eprintln!("[auth] ignoring malformed stored session for {account}: {error}");
      Ok(None)
    }
  }
}

#[tauri::command]
fn get_opencode_connection(state: State<'_, OpencodeState>) -> Result<OpencodeConnection, String> {
  clone_opencode_connection(&state)
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
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

#[tauri::command]
async fn restart_opencode(app: tauri::AppHandle) -> Result<OpencodeConnection, String> {
  stop_opencode(&app);
  start_opencode(&app).await?;
  let state = app.state::<OpencodeState>();
  clone_opencode_connection(&state)
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

fn extract_opencode_base_url(line: &[u8]) -> Option<String> {
  let text = String::from_utf8_lossy(line);
  let start = text.find("http://127.0.0.1:")?;
  let candidate = text[start..].split_whitespace().next()?;
  Some(candidate.to_string())
}

async fn wait_for_opencode_connection(
  receiver: &mut Receiver<CommandEvent>,
  username: String,
  password: String,
) -> Result<OpencodeConnection, String> {
  let deadline = Instant::now() + TokioDuration::from_secs(20);

  loop {
    let remaining = deadline
      .checked_duration_since(Instant::now())
      .ok_or_else(|| "Timed out waiting for OpenCode to announce its listening URL.".to_string())?;

    let event = timeout(remaining, receiver.recv())
      .await
      .map_err(|_| "Timed out waiting for OpenCode to announce its listening URL.".to_string())?
      .ok_or_else(|| "OpenCode exited before it announced a listening URL.".to_string())?;

    match event {
      CommandEvent::Stdout(line) => {
        eprintln!("[opencode] {}", String::from_utf8_lossy(&line));

        if let Some(base_url) = extract_opencode_base_url(&line) {
          let connection = OpencodeConnection {
            base_url,
            username: username.clone(),
            password: password.clone(),
          };

          wait_for_opencode(&connection).await?;
          return Ok(connection);
        }
      }
      CommandEvent::Stderr(line) => {
        eprintln!("[opencode:error] {}", String::from_utf8_lossy(&line));
      }
      CommandEvent::Error(error) => {
        eprintln!("[opencode:error] {error}");
      }
      CommandEvent::Terminated(payload) => {
        return Err(format!(
          "OpenCode exited before becoming ready (code: {:?}, signal: {:?}).",
          payload.code, payload.signal
        ));
      }
      _ => {}
    }
  }
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
  let username = format!("tinker-{}", random_url_safe(8));
  let password = random_url_safe(24);
  let github_token = read_keychain_session(app, AuthProvider::Github)?
    .map(|session| session.access_token().to_string())
    .unwrap_or_default();

  let mut sidecar = app
    .shell()
    .sidecar("opencode")
    .map_err(|error| error.to_string())?
    .args(["serve", "--hostname", "127.0.0.1", "--port", "0"])
    .envs([
      ("OPENCODE_CONFIG", config_path.to_string_lossy().into_owned()),
      ("OPENCODE_SERVER_USERNAME", username.clone()),
      ("OPENCODE_SERVER_PASSWORD", password.clone()),
    ])
    .current_dir(working_dir);

  if !github_token.is_empty() {
    sidecar = sidecar.env("TINKER_GITHUB_TOKEN", github_token);
  }

  let (mut receiver, child) = sidecar.spawn().map_err(|error| error.to_string())?;

  {
    let mut guard = state
      .child
      .lock()
      .map_err(|_| "OpenCode state lock was poisoned.".to_string())?;
    *guard = Some(child);
  }

  let connection = match wait_for_opencode_connection(&mut receiver, username, password).await {
    Ok(connection) => connection,
    Err(error) => {
      stop_opencode(app);
      return Err(error);
    }
  };

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
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .manage(BetterAuthState::default())
    .manage(OpencodeState::default())
    .invoke_handler(tauri::generate_handler![
      get_opencode_connection,
      restart_opencode,
      commands::auth::auth_sign_in,
      commands::auth::auth_sign_out,
      commands::auth::auth_status,
      commands::dialog::open_folder_picker
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
      crate::commands::auth::stop_better_auth(&handle);
      stop_opencode(&handle);
    }
  });
}
