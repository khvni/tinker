use std::{collections::HashMap, path::PathBuf, sync::Mutex};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_shell::{
  process::{CommandChild, CommandEvent},
  ShellExt,
};
use tokio::{
  io::{AsyncReadExt, AsyncWriteExt},
  net::TcpListener,
  time::{sleep, timeout, Duration as TokioDuration},
};
use url::Url;

pub const KEYRING_SERVICE: &str = "tinker";
pub const GOOGLE_SESSION_ACCOUNT: &str = "google-session";
pub const GITHUB_SESSION_ACCOUNT: &str = "github-session";

const BETTER_AUTH_TIMEOUT: TokioDuration = TokioDuration::from_secs(180);
const BETTER_AUTH_HEALTH_RETRY_COUNT: usize = 20;
const BETTER_AUTH_HEALTH_RETRY_DELAY: TokioDuration = TokioDuration::from_millis(500);
const BETTER_AUTH_SECRET_HEADER: &str = "x-tinker-bridge-secret";
const BETTER_AUTH_PORT_ENV: &str = "TINKER_BETTER_AUTH_PORT";
const DEFAULT_BETTER_AUTH_PORT: u16 = 3147;
const GOOGLE_CLIENT_ID_ENV: &str = "GOOGLE_OAUTH_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_ENV: &str = "GOOGLE_OAUTH_CLIENT_SECRET";
const GOOGLE_CLIENT_ID_ALIAS_ENV: &str = "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_ALIAS_ENV: &str = "GOOGLE_CLIENT_SECRET";
const GITHUB_CLIENT_ID_ENV: &str = "GITHUB_OAUTH_CLIENT_ID";
const GITHUB_CLIENT_SECRET_ENV: &str = "GITHUB_OAUTH_CLIENT_SECRET";
const GITHUB_CLIENT_ID_ALIAS_ENV: &str = "GITHUB_CLIENT_ID";
const GITHUB_CLIENT_SECRET_ALIAS_ENV: &str = "GITHUB_CLIENT_SECRET";
const BETTER_AUTH_SECRET_ENV: &str = "TINKER_BETTER_AUTH_SECRET";

#[derive(Clone)]
struct BetterAuthRuntime {
  base_url: String,
  bridge_secret: String,
}

#[derive(Default)]
pub struct BetterAuthState {
  child: Mutex<Option<CommandChild>>,
  runtime: Mutex<Option<BetterAuthRuntime>>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthProvider {
  Google,
  Github,
}

impl AuthProvider {
  fn as_str(self) -> &'static str {
    match self {
      AuthProvider::Google => "google",
      AuthProvider::Github => "github",
    }
  }

  fn display_name(self) -> &'static str {
    match self {
      AuthProvider::Google => "Google",
      AuthProvider::Github => "GitHub",
    }
  }

  fn client_id_env_names(self) -> &'static [&'static str] {
    match self {
      AuthProvider::Google => &[GOOGLE_CLIENT_ID_ENV, GOOGLE_CLIENT_ID_ALIAS_ENV],
      AuthProvider::Github => &[GITHUB_CLIENT_ID_ENV, GITHUB_CLIENT_ID_ALIAS_ENV],
    }
  }

  fn client_secret_env_names(self) -> &'static [&'static str] {
    match self {
      AuthProvider::Google => &[GOOGLE_CLIENT_SECRET_ENV, GOOGLE_CLIENT_SECRET_ALIAS_ENV],
      AuthProvider::Github => &[GITHUB_CLIENT_SECRET_ENV, GITHUB_CLIENT_SECRET_ALIAS_ENV],
    }
  }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SSOSession {
  provider: AuthProvider,
  user_id: String,
  email: String,
  display_name: String,
  avatar_url: Option<String>,
  access_token: String,
  refresh_token: String,
  expires_at: String,
  scopes: Vec<String>,
}

impl SSOSession {
  pub fn access_token(&self) -> &str {
    &self.access_token
  }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
  google: Option<SSOSession>,
  github: Option<SSOSession>,
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
}

fn provider_account(provider: AuthProvider) -> &'static str {
  match provider {
    AuthProvider::Google => GOOGLE_SESSION_ACCOUNT,
    AuthProvider::Github => GITHUB_SESSION_ACCOUNT,
  }
}

fn parse_callback_request(request: &str) -> Result<HashMap<String, String>, String> {
  let request_line = request
    .lines()
    .next()
    .ok_or_else(|| "Missing OAuth callback request line.".to_string())?;
  let path = request_line
    .split_whitespace()
    .nth(1)
    .ok_or_else(|| "Missing OAuth callback path.".to_string())?;
  let url = Url::parse(&format!("http://127.0.0.1{path}")).map_err(|error| error.to_string())?;

  Ok(url.query_pairs().into_owned().collect())
}

fn keyring_error(error: impl std::fmt::Display) -> String {
  format!("Keychain operation failed: {error}")
}

fn store_session<R: Runtime>(app: &AppHandle<R>, session: &SSOSession) -> Result<(), String> {
  app
    .keyring()
    .set_password(
      KEYRING_SERVICE,
      provider_account(session.provider),
      &serde_json::to_string(session).map_err(|error| error.to_string())?,
    )
    .map_err(keyring_error)
}

fn read_session<R: Runtime>(app: &AppHandle<R>, provider: AuthProvider) -> Result<Option<SSOSession>, String> {
  let account = provider_account(provider);
  let raw = app
    .keyring()
    .get_password(KEYRING_SERVICE, account)
    .map_err(keyring_error)?;

  let Some(raw) = raw else {
    return Ok(None);
  };

  match serde_json::from_str::<SSOSession>(&raw) {
    Ok(session) if session.provider == provider => Ok(Some(session)),
    Ok(_) | Err(_) => {
      clear_session(app, provider)?;
      Ok(None)
    }
  }
}

fn clear_session<R: Runtime>(app: &AppHandle<R>, provider: AuthProvider) -> Result<(), String> {
  let account = provider_account(provider);
  let existing = app
    .keyring()
    .get_password(KEYRING_SERVICE, account)
    .map_err(keyring_error)?;

  if existing.is_none() {
    return Ok(());
  }

  app
    .keyring()
    .delete_password(KEYRING_SERVICE, account)
    .map_err(keyring_error)
}

fn optional_env(name: &str) -> Option<String> {
  std::env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn is_placeholder_value(value: &str) -> bool {
  let normalized = value.trim().to_ascii_uppercase();
  normalized.contains("PLACEHOLDER")
    || normalized.starts_with("YOUR_")
    || normalized == "CHANGEME"
    || normalized == "CHANGE_ME"
}

fn looks_like_google_client_id(value: &str) -> bool {
  value.trim().ends_with(".apps.googleusercontent.com")
}

fn configured_better_auth_port() -> Result<u16, String> {
  match optional_env(BETTER_AUTH_PORT_ENV) {
    Some(value) => {
      let port = value
        .parse::<u16>()
        .map_err(|_| format!("Invalid {} value: {}", BETTER_AUTH_PORT_ENV, value))?;
      if port == 0 {
        return Err(format!("Invalid {} value: {}", BETTER_AUTH_PORT_ENV, value));
      }
      Ok(port)
    }
    None => Ok(DEFAULT_BETTER_AUTH_PORT),
  }
}

fn better_auth_callback_uri(provider: AuthProvider, port: u16) -> String {
  format!("http://127.0.0.1:{port}/api/auth/callback/{}", provider.as_str())
}

fn provider_configuration_message(provider: AuthProvider, port: u16) -> String {
  format!(
    "{} sign-in is not configured. Set {} and {}, then register redirect URI {}.",
    provider.display_name(),
    provider.client_id_env_names().join(" or "),
    provider.client_secret_env_names().join(" or "),
    better_auth_callback_uri(provider, port)
  )
}

fn first_usable_env(provider: AuthProvider, names: &[&str], validate: impl Fn(&str) -> bool) -> Option<String> {
  names
    .iter()
    .filter_map(|name| optional_env(name))
    .find(|value| {
      if is_placeholder_value(value) {
        return false;
      }

      match provider {
        AuthProvider::Google => validate(value),
        AuthProvider::Github => true,
      }
    })
}

fn require_provider_configuration(provider: AuthProvider) -> Result<(), String> {
  let port = configured_better_auth_port()?;
  let client_id = first_usable_env(provider, provider.client_id_env_names(), looks_like_google_client_id);
  let client_secret = first_usable_env(provider, provider.client_secret_env_names(), |_| true);

  if client_id.is_some() && client_secret.is_some() {
    return Ok(());
  }

  Err(provider_configuration_message(provider, port))
}

fn auth_sidecar_script_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    let dev_resource = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/auth-sidecar.mjs");
    if dev_resource.exists() {
      return dev_resource.canonicalize().map_err(|error| error.to_string());
    }

    let dev_dist = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../packages/auth-sidecar/dist/auth-sidecar.mjs");
    if dev_dist.exists() {
      return dev_dist.canonicalize().map_err(|error| error.to_string());
    }
  }

  let bundled = app
    .path()
    .resource_dir()
    .map_err(|error| error.to_string())?
    .join("auth-sidecar.mjs");

  if bundled.exists() {
    return Ok(bundled);
  }

  Err("Could not locate Better Auth sidecar bundle.".to_string())
}
async fn wait_for_better_auth(runtime: &BetterAuthRuntime) -> Result<(), String> {
  let client = reqwest::Client::new();
  let health_url = format!("{}/health", runtime.base_url);

  for _attempt in 0..BETTER_AUTH_HEALTH_RETRY_COUNT {
    match client.get(&health_url).send().await {
      Ok(response) if response.status().is_success() => return Ok(()),
      _ => sleep(BETTER_AUTH_HEALTH_RETRY_DELAY).await,
    }
  }

  Err("Timed out waiting for Better Auth sidecar to become healthy.".to_string())
}

fn spawn_auth_log_task(mut receiver: tauri::async_runtime::Receiver<CommandEvent>) {
  tauri::async_runtime::spawn(async move {
    while let Some(event) = receiver.recv().await {
      match event {
        CommandEvent::Stdout(line) => {
          eprintln!("[better-auth] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Stderr(line) => {
          eprintln!("[better-auth:error] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Error(error) => {
          eprintln!("[better-auth:error] {error}");
        }
        CommandEvent::Terminated(payload) => {
          eprintln!(
            "[better-auth] exited with code {:?} and signal {:?}",
            payload.code, payload.signal
          );
        }
        _ => {}
      }
    }
  });
}

async fn start_better_auth<R: Runtime>(app: &AppHandle<R>) -> Result<BetterAuthRuntime, String> {
  let script_path = auth_sidecar_script_path(app)?;
  let port = configured_better_auth_port()?;
  let bridge_secret = random_url_safe(24);
  let base_url = format!("http://127.0.0.1:{port}");

  let mut sidecar = app
    .shell()
    .sidecar("node")
    .map_err(|error| error.to_string())?
    .args([script_path.to_string_lossy().into_owned()])
    .envs([
      ("TINKER_BETTER_AUTH_PORT", port.to_string()),
      ("TINKER_BETTER_AUTH_BRIDGE_SECRET", bridge_secret.clone()),
    ]);

  if let Some(value) = first_usable_env(AuthProvider::Google, AuthProvider::Google.client_id_env_names(), looks_like_google_client_id) {
    sidecar = sidecar.env(GOOGLE_CLIENT_ID_ENV, value);
  }
  if let Some(value) = first_usable_env(AuthProvider::Google, AuthProvider::Google.client_secret_env_names(), |_| true) {
    sidecar = sidecar.env(GOOGLE_CLIENT_SECRET_ENV, value);
  }
  if let Some(value) = first_usable_env(AuthProvider::Github, AuthProvider::Github.client_id_env_names(), |_| true) {
    sidecar = sidecar.env(GITHUB_CLIENT_ID_ENV, value);
  }
  if let Some(value) = first_usable_env(AuthProvider::Github, AuthProvider::Github.client_secret_env_names(), |_| true) {
    sidecar = sidecar.env(GITHUB_CLIENT_SECRET_ENV, value);
  }
  if let Some(value) = optional_env(BETTER_AUTH_SECRET_ENV) {
    sidecar = sidecar.env(BETTER_AUTH_SECRET_ENV, value);
  }

  if let Some(parent) = script_path.parent() {
    sidecar = sidecar.current_dir(parent.to_path_buf());
  }

  let (receiver, child) = sidecar.spawn().map_err(|error| error.to_string())?;
  let runtime = BetterAuthRuntime { base_url, bridge_secret };

  {
    let state = app.state::<BetterAuthState>();
    let mut child_guard = state
      .child
      .lock()
      .map_err(|_| "Better Auth state lock was poisoned.".to_string())?;
    *child_guard = Some(child);
  }

  spawn_auth_log_task(receiver);

  if let Err(error) = wait_for_better_auth(&runtime).await {
    stop_better_auth(app);
    return Err(error);
  }

  {
    let state = app.state::<BetterAuthState>();
    let mut runtime_guard = state
      .runtime
      .lock()
      .map_err(|_| "Better Auth state lock was poisoned.".to_string())?;
    *runtime_guard = Some(runtime.clone());
  }

  Ok(runtime)
}

async fn ensure_better_auth<R: Runtime>(app: &AppHandle<R>) -> Result<BetterAuthRuntime, String> {
  let existing_runtime = {
    let state = app.state::<BetterAuthState>();
    let runtime = state
      .runtime
      .lock()
      .map_err(|_| "Better Auth state lock was poisoned.".to_string())?
      .clone();
    runtime
  };

  if let Some(runtime) = existing_runtime {
    if wait_for_better_auth(&runtime).await.is_ok() {
      return Ok(runtime);
    }

    stop_better_auth(app);
  }

  start_better_auth(app).await
}

fn callback_success_page(provider: AuthProvider) -> &'static [u8] {
  match provider {
    AuthProvider::Google | AuthProvider::Github => {
      b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>Tinker</h1><p>Sign-in finished. You can close this window and return to the app.</p></body></html>"
    }
  }
}

fn callback_error_page() -> &'static [u8] {
  b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h1>Tinker</h1><p>Sign-in finished with an error. You can close this window and return to the app.</p></body></html>"
}

async fn await_callback(provider: AuthProvider, listener: TcpListener) -> Result<HashMap<String, String>, String> {
  let (mut stream, _) = timeout(BETTER_AUTH_TIMEOUT, listener.accept())
    .await
    .map_err(|_| format!("Timed out waiting for {} sign-in callback.", provider.display_name()))?
    .map_err(|error| error.to_string())?;

  let mut buffer = [0_u8; 8192];
  let bytes_read = stream.read(&mut buffer).await.map_err(|error| error.to_string())?;
  let request = String::from_utf8_lossy(&buffer[..bytes_read]);
  let params = parse_callback_request(&request)?;

  let response = if params.contains_key("error") {
    callback_error_page()
  } else {
    callback_success_page(provider)
  };

  stream.write_all(response).await.map_err(|error| error.to_string())?;
  Ok(params)
}

fn callback_url(listener: &TcpListener) -> Result<String, String> {
  Ok(format!(
    "http://127.0.0.1:{}/callback",
    listener.local_addr().map_err(|error| error.to_string())?.port()
  ))
}

async fn fetch_transferred_session(runtime: &BetterAuthRuntime, ticket: &str) -> Result<SSOSession, String> {
  let url = Url::parse_with_params(&format!("{}/desktop/session", runtime.base_url), &[("ticket", ticket)])
    .map_err(|error| error.to_string())?;
  let response = reqwest::Client::new()
    .get(url)
    .header(BETTER_AUTH_SECRET_HEADER, runtime.bridge_secret.clone())
    .send()
    .await
    .map_err(|error| error.to_string())?;

  if !response.status().is_success() {
    let body = response.text().await.unwrap_or_default();
    return Err(if body.is_empty() {
      "Better Auth sidecar rejected session transfer.".to_string()
    } else {
      format!("Better Auth sidecar rejected session transfer: {body}")
    });
  }

  response.json::<SSOSession>().await.map_err(|error| error.to_string())
}

fn callback_error_message(provider: AuthProvider, params: &HashMap<String, String>) -> String {
  let code = params
    .get("error")
    .cloned()
    .unwrap_or_else(|| "oauth_failed".to_string());
  let port = configured_better_auth_port().unwrap_or(DEFAULT_BETTER_AUTH_PORT);

  if provider == AuthProvider::Google
    && (code == "invalid_client"
      || code == "redirect_uri_mismatch"
      || params
        .get("errorDescription")
        .is_some_and(|value| value.contains("OAuth client was not found") || value.contains("redirect_uri_mismatch")))
  {
    let setup_hint = provider_configuration_message(provider, port);
    if let Some(description) = params.get("errorDescription").filter(|value| !value.trim().is_empty()) {
      return format!("{setup_hint} Google said: {description}");
    }

    return setup_hint;
  }

  if let Some(description) = params.get("errorDescription").filter(|value| !value.trim().is_empty()) {
    return format!("{} sign-in failed: {description}", provider.display_name());
  }

  format!("{} sign-in failed: {}", provider.display_name(), code.replace('_', " "))
}

async fn sign_in_with_better_auth<R: Runtime>(app: &AppHandle<R>, provider: AuthProvider) -> Result<SSOSession, String> {
  require_provider_configuration(provider)?;

  let runtime = ensure_better_auth(app).await?;
  let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|error| error.to_string())?;
  let ticket = random_url_safe(24);
  let callback = callback_url(&listener)?;
  let sign_in_url = Url::parse_with_params(
    &format!("{}/desktop/sign-in/{}", runtime.base_url, provider.as_str()),
    &[("ticket", ticket.as_str()), ("appCallback", callback.as_str())],
  )
  .map_err(|error| error.to_string())?;

  webbrowser::open(sign_in_url.as_str()).map_err(|error| error.to_string())?;

  let params = await_callback(provider, listener).await?;
  if params.contains_key("error") {
    return Err(callback_error_message(provider, &params));
  }

  let returned_ticket = params
    .get("ticket")
    .ok_or_else(|| format!("{} sign-in callback did not include transfer ticket.", provider.display_name()))?;
  if returned_ticket != &ticket {
    return Err(format!(
      "{} sign-in callback returned mismatched transfer ticket.",
      provider.display_name()
    ));
  }

  let session = fetch_transferred_session(&runtime, &ticket).await?;
  if session.provider != provider {
    return Err("Better Auth returned session for wrong provider.".to_string());
  }

  store_session(app, &session)?;
  Ok(session)
}

pub fn stop_better_auth<R: Runtime>(app: &tauri::AppHandle<R>) {
  let child = {
    let state = app.state::<BetterAuthState>();

    if let Ok(mut runtime_guard) = state.runtime.lock() {
      *runtime_guard = None;
    }

    let child = match state.child.lock() {
      Ok(mut child_guard) => child_guard.take(),
      Err(_) => None,
    };

    child
  };

  if let Some(child) = child {
    let _ = child.kill();
  }
}

#[tauri::command]
pub async fn auth_sign_in<R: Runtime>(app: AppHandle<R>, provider: AuthProvider) -> Result<SSOSession, String> {
  sign_in_with_better_auth(&app, provider).await
}

#[tauri::command]
pub fn auth_sign_out<R: Runtime>(app: AppHandle<R>, provider: AuthProvider) -> Result<(), String> {
  clear_session(&app, provider)
}

#[tauri::command]
pub fn auth_status<R: Runtime>(app: AppHandle<R>) -> Result<AuthStatus, String> {
  Ok(AuthStatus {
    google: read_session(&app, AuthProvider::Google)?,
    github: read_session(&app, AuthProvider::Github)?,
  })
}
