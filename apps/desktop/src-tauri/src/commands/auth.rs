use std::{path::PathBuf, sync::Mutex, time::Instant};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_shell::{
  process::{CommandChild, CommandEvent},
  ShellExt,
};
use tokio::time::{sleep, Duration as TokioDuration};

pub const KEYRING_SERVICE: &str = "tinker";
pub const GOOGLE_SESSION_ACCOUNT: &str = "google-session";
pub const GITHUB_SESSION_ACCOUNT: &str = "github-session";

const BETTER_AUTH_TIMEOUT: TokioDuration = TokioDuration::from_secs(180);
const BETTER_AUTH_HEALTH_RETRY_COUNT: usize = 20;
const BETTER_AUTH_HEALTH_RETRY_DELAY: TokioDuration = TokioDuration::from_millis(500);
const BETTER_AUTH_SESSION_POLL_DELAY: TokioDuration = TokioDuration::from_millis(500);
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthStartResponse {
  ticket: String,
  authorization_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthSessionUser {
  id: String,
  provider_user_id: String,
  email: String,
  display_name: String,
  avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthSessionTokens {
  access_token: String,
  refresh_token: String,
  expires_at: String,
  scopes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthSessionResponse {
  authenticated: bool,
  provider: Option<AuthProvider>,
  user: Option<AuthSessionUser>,
  tokens: Option<AuthSessionTokens>,
  status: Option<String>,
  error: Option<String>,
}

#[derive(Debug)]
enum PollAuthSession {
  Pending,
  Ready(SSOSession),
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

pub(crate) fn keyring_error(error: impl std::fmt::Display) -> String {
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

fn parse_auth_session_response(
  provider: AuthProvider,
  response: AuthSessionResponse,
) -> Result<PollAuthSession, String> {
  if !response.authenticated {
    if response.status.as_deref() == Some("pending") {
      return Ok(PollAuthSession::Pending);
    }

    if let Some(error) = response.error.filter(|value| !value.trim().is_empty()) {
      return Err(format!("{} sign-in failed: {error}", provider.display_name()));
    }

    let status = response.status.unwrap_or_else(|| "unknown".to_string());
    return Err(format!("{} sign-in failed: {status}", provider.display_name()));
  }

  if response.provider != Some(provider) {
    return Err("Better Auth returned session for wrong provider.".to_string());
  }

  let user = response
    .user
    .ok_or_else(|| "Better Auth session response was missing user details.".to_string())?;
  let tokens = response
    .tokens
    .ok_or_else(|| "Better Auth session response was missing token details.".to_string())?;

  let user_id = if user.provider_user_id.trim().is_empty() {
    user.id
  } else {
    user.provider_user_id
  };

  Ok(PollAuthSession::Ready(SSOSession {
    provider,
    user_id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    scopes: tokens.scopes,
  }))
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

async fn start_auth_session(runtime: &BetterAuthRuntime, provider: AuthProvider) -> Result<AuthStartResponse, String> {
  let response = reqwest::Client::new()
    .post(format!("{}/auth/start", runtime.base_url))
    .header(BETTER_AUTH_SECRET_HEADER, runtime.bridge_secret.clone())
    .json(&serde_json::json!({
      "provider": provider.as_str(),
    }))
    .send()
    .await
    .map_err(|error| error.to_string())?;

  if !response.status().is_success() {
    let body = response.text().await.unwrap_or_default();
    return Err(if body.is_empty() {
      format!("{} sign-in could not be started.", provider.display_name())
    } else {
      format!("{} sign-in could not be started: {body}", provider.display_name())
    });
  }

  response.json::<AuthStartResponse>().await.map_err(|error| error.to_string())
}

async fn poll_auth_session(
  runtime: &BetterAuthRuntime,
  provider: AuthProvider,
  ticket: &str,
) -> Result<SSOSession, String> {
  let client = reqwest::Client::new();
  let started_at = Instant::now();

  while started_at.elapsed() < BETTER_AUTH_TIMEOUT {
    let response = client
      .get(format!("{}/auth/session", runtime.base_url))
      .query(&[("ticket", ticket)])
      .header(BETTER_AUTH_SECRET_HEADER, runtime.bridge_secret.clone())
      .send()
      .await
      .map_err(|error| error.to_string())?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
      return Err(format!("{} sign-in session expired before completion.", provider.display_name()));
    }

    if !response.status().is_success() {
      let body = response.text().await.unwrap_or_default();
      return Err(if body.is_empty() {
        format!("{} sign-in session could not be read.", provider.display_name())
      } else {
        format!("{} sign-in session could not be read: {body}", provider.display_name())
      });
    }

    match parse_auth_session_response(
      provider,
      response.json::<AuthSessionResponse>().await.map_err(|error| error.to_string())?,
    )? {
      PollAuthSession::Pending => sleep(BETTER_AUTH_SESSION_POLL_DELAY).await,
      PollAuthSession::Ready(session) => return Ok(session),
    }
  }

  Err(format!("Timed out waiting for {} sign-in to finish.", provider.display_name()))
}

async fn sign_in_with_better_auth<R: Runtime>(app: &AppHandle<R>, provider: AuthProvider) -> Result<SSOSession, String> {
  require_provider_configuration(provider)?;

  let runtime = ensure_better_auth(app).await?;
  let start = start_auth_session(&runtime, provider).await?;

  webbrowser::open(start.authorization_url.as_str()).map_err(|error| error.to_string())?;

  let session = poll_auth_session(&runtime, provider, &start.ticket).await?;
  store_session(app, &session)?;
  if !session.refresh_token.trim().is_empty() {
    crate::commands::keychain::save_refresh_token(
      app.clone(),
      provider.as_str().to_string(),
      session.user_id.clone(),
      session.refresh_token.clone(),
    )?;
  }
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
  if let Some(session) = read_session(&app, provider)? {
    crate::commands::keychain::clear_refresh_token(app.clone(), provider.as_str().to_string(), session.user_id.clone())?;
  }

  clear_session(&app, provider)
}

#[tauri::command]
pub fn auth_status<R: Runtime>(app: AppHandle<R>) -> Result<AuthStatus, String> {
  Ok(AuthStatus {
    google: read_session(&app, AuthProvider::Google)?,
    github: read_session(&app, AuthProvider::Github)?,
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_auth_session_response_keeps_pending_sessions_pending() {
    let response = AuthSessionResponse {
      authenticated: false,
      provider: None,
      user: None,
      tokens: None,
      status: Some("pending".to_string()),
      error: None,
    };

    assert!(matches!(
      parse_auth_session_response(AuthProvider::Google, response).unwrap(),
      PollAuthSession::Pending
    ));
  }

  #[test]
  fn parse_auth_session_response_maps_ready_session() {
    let response = AuthSessionResponse {
      authenticated: true,
      provider: Some(AuthProvider::Google),
      user: Some(AuthSessionUser {
        id: "google-sub".to_string(),
        provider_user_id: "provider-user".to_string(),
        email: "ada@example.com".to_string(),
        display_name: "Ada Lovelace".to_string(),
        avatar_url: Some("https://example.com/avatar.png".to_string()),
      }),
      tokens: Some(AuthSessionTokens {
        access_token: "access-token".to_string(),
        refresh_token: "refresh-token".to_string(),
        expires_at: "2026-04-22T03:00:00Z".to_string(),
        scopes: vec!["openid".to_string(), "email".to_string(), "profile".to_string()],
      }),
      status: None,
      error: None,
    };

    let session = match parse_auth_session_response(AuthProvider::Google, response).unwrap() {
      PollAuthSession::Ready(session) => session,
      PollAuthSession::Pending => panic!("expected ready session"),
    };

    assert_eq!(session.provider, AuthProvider::Google);
    assert_eq!(session.user_id, "provider-user");
    assert_eq!(session.email, "ada@example.com");
    assert_eq!(session.refresh_token, "refresh-token");
  }

  #[test]
  fn parse_auth_session_response_surfaces_sidecar_errors() {
    let response = AuthSessionResponse {
      authenticated: false,
      provider: None,
      user: None,
      tokens: None,
      status: Some("error".to_string()),
      error: Some("oauth_failed".to_string()),
    };

    assert_eq!(
      parse_auth_session_response(AuthProvider::Github, response).unwrap_err(),
      "GitHub sign-in failed: oauth_failed"
    );
  }
}
