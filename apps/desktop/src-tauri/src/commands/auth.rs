use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::{spawn, Receiver};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::time::{sleep, Duration as TokioDuration, Instant};

pub const KEYRING_SERVICE: &str = "tinker";
pub const GOOGLE_SESSION_ACCOUNT: &str = "google-session";
pub const GITHUB_SESSION_ACCOUNT: &str = "github-session";
pub const MICROSOFT_SESSION_ACCOUNT: &str = "microsoft-session";

const AUTH_SIDECAR_MANIFEST_NAME: &str = "auth-sidecar.json";
const BETTER_AUTH_TIMEOUT: TokioDuration = TokioDuration::from_secs(180);
const BETTER_AUTH_HEALTH_TIMEOUT: TokioDuration = TokioDuration::from_secs(20);
const BETTER_AUTH_HEALTH_POLL_INTERVAL: TokioDuration = TokioDuration::from_millis(100);
const BETTER_AUTH_SESSION_POLL_DELAY: TokioDuration = TokioDuration::from_millis(500);
const BETTER_AUTH_SECRET_HEADER: &str = "x-tinker-bridge-secret";
const BETTER_AUTH_PORT_ENV: &str = "TINKER_BETTER_AUTH_PORT";
const DEFAULT_BETTER_AUTH_PORT: u16 = 3147;
const BETTER_AUTH_SECRET_ENV: &str = "TINKER_BETTER_AUTH_SECRET";
const PROCESS_POLL_INTERVAL: TokioDuration = TokioDuration::from_millis(50);
const GRACEFUL_SHUTDOWN_TIMEOUT: TokioDuration = TokioDuration::from_secs(2);

const GOOGLE_CLIENT_ID_ENV: &str = "GOOGLE_OAUTH_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_ENV: &str = "GOOGLE_OAUTH_CLIENT_SECRET";
const GOOGLE_CLIENT_ID_ALIAS_ENV: &str = "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET_ALIAS_ENV: &str = "GOOGLE_CLIENT_SECRET";

const GITHUB_CLIENT_ID_ENV: &str = "GITHUB_OAUTH_CLIENT_ID";
const GITHUB_CLIENT_SECRET_ENV: &str = "GITHUB_OAUTH_CLIENT_SECRET";
const GITHUB_CLIENT_ID_ALIAS_ENV: &str = "GITHUB_CLIENT_ID";
const GITHUB_CLIENT_SECRET_ALIAS_ENV: &str = "GITHUB_CLIENT_SECRET";

const MICROSOFT_CLIENT_ID_ENV: &str = "MICROSOFT_OAUTH_CLIENT_ID";
const MICROSOFT_CLIENT_SECRET_ENV: &str = "MICROSOFT_OAUTH_CLIENT_SECRET";
const MICROSOFT_TENANT_ENV: &str = "MICROSOFT_OAUTH_TENANT_ID";
const MICROSOFT_CLIENT_ID_ALIAS_ENV: &str = "MICROSOFT_CLIENT_ID";
const MICROSOFT_CLIENT_SECRET_ALIAS_ENV: &str = "MICROSOFT_CLIENT_SECRET";
const MICROSOFT_TENANT_ALIAS_ENV: &str = "MICROSOFT_TENANT_ID";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthHandle {
    pub base_url: String,
    pub pid: u32,
}

#[derive(Clone)]
struct BetterAuthRuntime {
    handle: AuthHandle,
    bridge_secret: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct BetterAuthManifest {
    pid: u32,
    port: u16,
    secret: String,
    base_url: String,
}

#[derive(Clone)]
struct BetterAuthSpawnConfig {
    port: u16,
    bridge_secret: String,
    google_client_id: Option<String>,
    google_client_secret: Option<String>,
    github_client_id: Option<String>,
    github_client_secret: Option<String>,
    microsoft_client_id: Option<String>,
    microsoft_client_secret: Option<String>,
    microsoft_tenant_id: Option<String>,
    better_auth_secret: Option<String>,
}

#[derive(Default)]
pub struct BetterAuthState {
    runtime: Mutex<Option<BetterAuthRuntime>>,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthProvider {
    Google,
    Github,
    Microsoft,
}

impl AuthProvider {
    fn as_str(self) -> &'static str {
        match self {
            AuthProvider::Google => "google",
            AuthProvider::Github => "github",
            AuthProvider::Microsoft => "microsoft",
        }
    }

    fn display_name(self) -> &'static str {
        match self {
            AuthProvider::Google => "Google",
            AuthProvider::Github => "GitHub",
            AuthProvider::Microsoft => "Microsoft",
        }
    }

    fn client_id_env_names(self) -> &'static [&'static str] {
        match self {
            AuthProvider::Google => &[GOOGLE_CLIENT_ID_ENV, GOOGLE_CLIENT_ID_ALIAS_ENV],
            AuthProvider::Github => &[GITHUB_CLIENT_ID_ENV, GITHUB_CLIENT_ID_ALIAS_ENV],
            AuthProvider::Microsoft => &[MICROSOFT_CLIENT_ID_ENV, MICROSOFT_CLIENT_ID_ALIAS_ENV],
        }
    }

    fn client_secret_env_names(self) -> &'static [&'static str] {
        match self {
            AuthProvider::Google => &[GOOGLE_CLIENT_SECRET_ENV, GOOGLE_CLIENT_SECRET_ALIAS_ENV],
            AuthProvider::Github => &[GITHUB_CLIENT_SECRET_ENV, GITHUB_CLIENT_SECRET_ALIAS_ENV],
            AuthProvider::Microsoft => &[
                MICROSOFT_CLIENT_SECRET_ENV,
                MICROSOFT_CLIENT_SECRET_ALIAS_ENV,
            ],
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
    microsoft: Option<SSOSession>,
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
        AuthProvider::Microsoft => MICROSOFT_SESSION_ACCOUNT,
    }
}

pub(crate) fn keyring_error(error: impl std::fmt::Display) -> String {
    format!("Keychain operation failed: {error}")
}

fn store_session<R: Runtime>(app: &AppHandle<R>, session: &SSOSession) -> Result<(), String> {
    app.keyring()
        .set_password(
            KEYRING_SERVICE,
            provider_account(session.provider),
            &serde_json::to_string(session).map_err(|error| error.to_string())?,
        )
        .map_err(keyring_error)
}

fn read_session<R: Runtime>(
    app: &AppHandle<R>,
    provider: AuthProvider,
) -> Result<Option<SSOSession>, String> {
    let raw = app
        .keyring()
        .get_password(KEYRING_SERVICE, provider_account(provider))
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

    app.keyring()
        .delete_password(KEYRING_SERVICE, account)
        .map_err(keyring_error)
}

fn optional_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
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
    format!(
        "http://127.0.0.1:{port}/api/auth/callback/{}",
        provider.as_str()
    )
}

fn provider_configuration_message(provider: AuthProvider, port: u16) -> String {
    match provider {
    AuthProvider::Microsoft => format!(
      "{} sign-in is not configured. Set {}, register redirect URI {}, and enable public client flows.",
      provider.display_name(),
      provider.client_id_env_names().join(" or "),
      better_auth_callback_uri(provider, port)
    ),
    _ => format!(
      "{} sign-in is not configured. Set {} and {}, then register redirect URI {}.",
      provider.display_name(),
      provider.client_id_env_names().join(" or "),
      provider.client_secret_env_names().join(" or "),
      better_auth_callback_uri(provider, port)
    ),
  }
}

fn first_usable_env(
    provider: AuthProvider,
    names: &[&str],
    validate: impl Fn(&str) -> bool,
) -> Option<String> {
    names
        .iter()
        .filter_map(|name| optional_env(name))
        .find(|value| {
            if is_placeholder_value(value) {
                return false;
            }

            match provider {
                AuthProvider::Google => validate(value),
                AuthProvider::Github | AuthProvider::Microsoft => true,
            }
        })
}

fn require_provider_configuration(provider: AuthProvider) -> Result<(), String> {
    let port = configured_better_auth_port()?;
    let client_id = first_usable_env(
        provider,
        provider.client_id_env_names(),
        looks_like_google_client_id,
    );

    let configured = match provider {
        AuthProvider::Microsoft => client_id.is_some(),
        AuthProvider::Google | AuthProvider::Github => {
            let client_secret =
                first_usable_env(provider, provider.client_secret_env_names(), |_| true);
            client_id.is_some() && client_secret.is_some()
        }
    };

    if configured {
        return Ok(());
    }

    Err(provider_configuration_message(provider, port))
}

fn build_better_auth_spawn_config() -> Result<BetterAuthSpawnConfig, String> {
    Ok(BetterAuthSpawnConfig {
        port: configured_better_auth_port()?,
        bridge_secret: random_url_safe(24),
        google_client_id: first_usable_env(
            AuthProvider::Google,
            AuthProvider::Google.client_id_env_names(),
            looks_like_google_client_id,
        ),
        google_client_secret: first_usable_env(
            AuthProvider::Google,
            AuthProvider::Google.client_secret_env_names(),
            |_| true,
        ),
        github_client_id: first_usable_env(
            AuthProvider::Github,
            AuthProvider::Github.client_id_env_names(),
            |_| true,
        ),
        github_client_secret: first_usable_env(
            AuthProvider::Github,
            AuthProvider::Github.client_secret_env_names(),
            |_| true,
        ),
        microsoft_client_id: first_usable_env(
            AuthProvider::Microsoft,
            AuthProvider::Microsoft.client_id_env_names(),
            |_| true,
        ),
        microsoft_client_secret: first_usable_env(
            AuthProvider::Microsoft,
            AuthProvider::Microsoft.client_secret_env_names(),
            |_| true,
        ),
        microsoft_tenant_id: first_usable_env(
            AuthProvider::Microsoft,
            &[MICROSOFT_TENANT_ENV, MICROSOFT_TENANT_ALIAS_ENV],
            |_| true,
        ),
        better_auth_secret: optional_env(BETTER_AUTH_SECRET_ENV),
    })
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
            return Err(format!(
                "{} sign-in failed: {error}",
                provider.display_name()
            ));
        }

        let status = response.status.unwrap_or_else(|| "unknown".to_string());
        return Err(format!(
            "{} sign-in failed: {status}",
            provider.display_name()
        ));
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
        let dev_resource =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/auth-sidecar.mjs");
        if dev_resource.exists() {
            return dev_resource
                .canonicalize()
                .map_err(|error| error.to_string());
        }

        let dev_dist = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../packages/auth-sidecar/dist/auth-sidecar.mjs");
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

fn auth_manifest_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("resolve home dir: {error}"))?;
    let manifests_dir = crate::commands::opencode::manifests_dir(&home)?;
    Ok(manifests_dir.join(AUTH_SIDECAR_MANIFEST_NAME))
}

fn read_auth_manifest(path: &Path) -> Result<Option<BetterAuthManifest>, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("read auth manifest {path:?}: {error}")),
    };

    match serde_json::from_str::<BetterAuthManifest>(&content) {
        Ok(manifest) => Ok(Some(manifest)),
        Err(error) => {
            let _ = fs::remove_file(path);
            eprintln!("[better-auth] removing invalid manifest {path:?}: {error}");
            Ok(None)
        }
    }
}

fn write_auth_manifest(path: &Path, manifest: &BetterAuthManifest) -> Result<(), String> {
    let content = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("serialize auth manifest: {error}"))?;
    fs::write(path, content).map_err(|error| format!("write auth manifest {path:?}: {error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("chmod auth manifest {path:?}: {error}"))?;
    }

    Ok(())
}

fn clear_auth_manifest(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("remove auth manifest {path:?}: {error}")),
    }
}

fn runtime_from_manifest(manifest: BetterAuthManifest) -> BetterAuthRuntime {
    BetterAuthRuntime {
        handle: AuthHandle {
            base_url: manifest.base_url,
            pid: manifest.pid,
        },
        bridge_secret: manifest.secret,
    }
}

fn cached_runtime<R: Runtime>(app: &AppHandle<R>) -> Result<Option<BetterAuthRuntime>, String> {
    let state = app.state::<BetterAuthState>();
    state
        .runtime
        .lock()
        .map_err(|_| "Better Auth state lock was poisoned.".to_string())
        .map(|runtime| runtime.clone())
}

fn set_cached_runtime<R: Runtime>(
    app: &AppHandle<R>,
    runtime: Option<BetterAuthRuntime>,
) -> Result<(), String> {
    let state = app.state::<BetterAuthState>();
    let mut guard = state
        .runtime
        .lock()
        .map_err(|_| "Better Auth state lock was poisoned.".to_string())?;
    *guard = runtime;
    Ok(())
}

async fn wait_for_better_auth(runtime: &BetterAuthRuntime) -> Result<(), String> {
    let client = reqwest::Client::new();
    let health_url = format!("{}/health", runtime.handle.base_url);
    let deadline = Instant::now() + BETTER_AUTH_HEALTH_TIMEOUT;

    loop {
        if let Ok(response) = client.get(&health_url).send().await {
            if response.status().is_success() {
                return Ok(());
            }
        }

        if Instant::now() >= deadline {
            return Err("Timed out waiting for Better Auth sidecar to become healthy.".to_string());
        }

        sleep(BETTER_AUTH_HEALTH_POLL_INTERVAL).await;
    }
}

fn detach_auth_process(pid: u32, child: CommandChild, mut receiver: Receiver<CommandEvent>) {
    spawn(async move {
        let _detached = child;
        while let Some(event) = receiver.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("[better-auth:{pid}] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!(
                        "[better-auth:{pid}:error] {}",
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Error(error) => {
                    eprintln!("[better-auth:{pid}:error] {error}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!(
                        "[better-auth:{pid}] terminated code={:?} signal={:?}",
                        payload.code, payload.signal
                    );
                    break;
                }
                _ => {}
            }
        }
    });
}

#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
    let result = unsafe { libc::kill(pid as libc::pid_t, 0) };
    if result == 0 {
        true
    } else {
        std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
    }
}

#[cfg(unix)]
fn send_unix_signal(pid: u32, signal: libc::c_int) -> Result<(), String> {
    let result = unsafe { libc::kill(pid as libc::pid_t, signal) };
    if result == 0 {
        return Ok(());
    }

    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        return Ok(());
    }

    Err(format!("kill(pid={pid}, signal={signal}): {error}"))
}

#[cfg(unix)]
fn send_term(pid: u32) -> Result<(), String> {
    send_unix_signal(pid, libc::SIGTERM)
}

#[cfg(unix)]
fn send_kill(pid: u32) -> Result<(), String> {
    send_unix_signal(pid, libc::SIGKILL)
}

#[cfg(unix)]
async fn stop_auth_process(pid: u32) -> Result<(), String> {
    send_term(pid)?;

    let deadline = Instant::now() + GRACEFUL_SHUTDOWN_TIMEOUT;
    while Instant::now() < deadline {
        if !process_alive(pid) {
            return Ok(());
        }
        sleep(PROCESS_POLL_INTERVAL).await;
    }

    if process_alive(pid) {
        send_kill(pid)?;
    }

    Ok(())
}

async fn clear_stale_runtime<R: Runtime>(
    app: &AppHandle<R>,
    runtime: &BetterAuthRuntime,
) -> Result<(), String> {
    #[cfg(unix)]
    {
        let _ = stop_auth_process(runtime.handle.pid).await;
    }

    clear_auth_manifest(&auth_manifest_path(app)?)?;
    Ok(())
}

async fn spawn_better_auth<R: Runtime>(
    app: &AppHandle<R>,
    config: &BetterAuthSpawnConfig,
) -> Result<BetterAuthRuntime, String> {
    let script_path = auth_sidecar_script_path(app)?;
    let base_url = format!("http://127.0.0.1:{}", config.port);

    let mut sidecar = app
        .shell()
        .sidecar("node")
        .map_err(|error| error.to_string())?
        .args([script_path.to_string_lossy().into_owned()])
        .envs([
            (BETTER_AUTH_PORT_ENV, config.port.to_string()),
            (
                "TINKER_BETTER_AUTH_BRIDGE_SECRET",
                config.bridge_secret.clone(),
            ),
        ]);

    if let Some(value) = &config.google_client_id {
        sidecar = sidecar.env(GOOGLE_CLIENT_ID_ENV, value);
    }
    if let Some(value) = &config.google_client_secret {
        sidecar = sidecar.env(GOOGLE_CLIENT_SECRET_ENV, value);
    }
    if let Some(value) = &config.github_client_id {
        sidecar = sidecar.env(GITHUB_CLIENT_ID_ENV, value);
    }
    if let Some(value) = &config.github_client_secret {
        sidecar = sidecar.env(GITHUB_CLIENT_SECRET_ENV, value);
    }
    if let Some(value) = &config.microsoft_client_id {
        sidecar = sidecar.env(MICROSOFT_CLIENT_ID_ENV, value);
    }
    if let Some(value) = &config.microsoft_client_secret {
        sidecar = sidecar.env(MICROSOFT_CLIENT_SECRET_ENV, value);
    }
    if let Some(value) = &config.microsoft_tenant_id {
        sidecar = sidecar.env(MICROSOFT_TENANT_ENV, value);
    }
    if let Some(value) = &config.better_auth_secret {
        sidecar = sidecar.env(BETTER_AUTH_SECRET_ENV, value);
    }

    if let Some(parent) = script_path.parent() {
        sidecar = sidecar.current_dir(parent.to_path_buf());
    }

    let (receiver, child) = sidecar.spawn().map_err(|error| error.to_string())?;
    let pid = child.pid();
    let runtime = BetterAuthRuntime {
        handle: AuthHandle {
            base_url: base_url.clone(),
            pid,
        },
        bridge_secret: config.bridge_secret.clone(),
    };

    if let Err(error) = wait_for_better_auth(&runtime).await {
        let _ = child.kill();
        return Err(error);
    }

    let manifest = BetterAuthManifest {
        pid,
        port: config.port,
        secret: config.bridge_secret.clone(),
        base_url,
    };
    let manifest_path = auth_manifest_path(app)?;
    if let Err(error) = write_auth_manifest(&manifest_path, &manifest) {
        let _ = child.kill();
        return Err(error);
    }

    detach_auth_process(pid, child, receiver);
    Ok(runtime)
}

async fn adopt_better_auth<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<BetterAuthRuntime>, String> {
    let manifest_path = auth_manifest_path(app)?;
    let Some(manifest) = read_auth_manifest(&manifest_path)? else {
        return Ok(None);
    };

    #[cfg(unix)]
    if !process_alive(manifest.pid) {
        clear_auth_manifest(&manifest_path)?;
        return Ok(None);
    }

    let runtime = runtime_from_manifest(manifest);
    if wait_for_better_auth(&runtime).await.is_ok() {
        return Ok(Some(runtime));
    }

    clear_stale_runtime(app, &runtime).await?;
    Ok(None)
}

async fn ensure_better_auth<R: Runtime>(
    app: &AppHandle<R>,
    config: &BetterAuthSpawnConfig,
) -> Result<BetterAuthRuntime, String> {
    if let Some(runtime) = cached_runtime(app)? {
        if wait_for_better_auth(&runtime).await.is_ok() {
            return Ok(runtime);
        }

        set_cached_runtime(app, None)?;
        clear_stale_runtime(app, &runtime).await?;
    }

    if let Some(runtime) = adopt_better_auth(app).await? {
        set_cached_runtime(app, Some(runtime.clone()))?;
        return Ok(runtime);
    }

    let runtime = spawn_better_auth(app, config).await?;
    set_cached_runtime(app, Some(runtime.clone()))?;
    Ok(runtime)
}

async fn start_auth_session(
    runtime: &BetterAuthRuntime,
    provider: AuthProvider,
) -> Result<AuthStartResponse, String> {
    let response = reqwest::Client::new()
        .post(format!("{}/auth/start", runtime.handle.base_url))
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
            format!(
                "{} sign-in could not be started: {body}",
                provider.display_name()
            )
        });
    }

    response
        .json::<AuthStartResponse>()
        .await
        .map_err(|error| error.to_string())
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
            .get(format!("{}/auth/session", runtime.handle.base_url))
            .query(&[("ticket", ticket)])
            .header(BETTER_AUTH_SECRET_HEADER, runtime.bridge_secret.clone())
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(format!(
                "{} sign-in session expired before completion.",
                provider.display_name()
            ));
        }

        if !response.status().is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(if body.is_empty() {
                format!(
                    "{} sign-in session could not be read.",
                    provider.display_name()
                )
            } else {
                format!(
                    "{} sign-in session could not be read: {body}",
                    provider.display_name()
                )
            });
        }

        match parse_auth_session_response(
            provider,
            response
                .json::<AuthSessionResponse>()
                .await
                .map_err(|error| error.to_string())?,
        )? {
            PollAuthSession::Pending => sleep(BETTER_AUTH_SESSION_POLL_DELAY).await,
            PollAuthSession::Ready(session) => return Ok(session),
        }
    }

    Err(format!(
        "Timed out waiting for {} sign-in to finish.",
        provider.display_name()
    ))
}

async fn sign_in_with_better_auth<R: Runtime>(
    app: &AppHandle<R>,
    provider: AuthProvider,
) -> Result<SSOSession, String> {
    require_provider_configuration(provider)?;

    let runtime = ensure_better_auth(app, &build_better_auth_spawn_config()?).await?;
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

#[tauri::command]
pub async fn start_auth_sidecar<R: Runtime>(app: AppHandle<R>) -> Result<AuthHandle, String> {
    let runtime = ensure_better_auth(&app, &build_better_auth_spawn_config()?).await?;
    Ok(runtime.handle)
}

#[tauri::command]
pub async fn auth_sign_in<R: Runtime>(
    app: AppHandle<R>,
    provider: AuthProvider,
) -> Result<SSOSession, String> {
    sign_in_with_better_auth(&app, provider).await
}

#[tauri::command]
pub fn auth_sign_out<R: Runtime>(app: AppHandle<R>, provider: AuthProvider) -> Result<(), String> {
    if let Some(session) = read_session(&app, provider)? {
        crate::commands::keychain::clear_refresh_token(
            app.clone(),
            provider.as_str().to_string(),
            session.user_id.clone(),
        )?;
    }

    clear_session(&app, provider)
}

#[tauri::command]
pub fn auth_status<R: Runtime>(app: AppHandle<R>) -> Result<AuthStatus, String> {
    Ok(AuthStatus {
        google: read_session(&app, AuthProvider::Google)?,
        github: read_session(&app, AuthProvider::Github)?,
        microsoft: read_session(&app, AuthProvider::Microsoft)?,
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
    fn parse_auth_session_response_maps_ready_session_for_microsoft() {
        let response = AuthSessionResponse {
            authenticated: true,
            provider: Some(AuthProvider::Microsoft),
            user: Some(AuthSessionUser {
                id: "microsoft-sub".to_string(),
                provider_user_id: "provider-user".to_string(),
                email: "ada@example.com".to_string(),
                display_name: "Ada Lovelace".to_string(),
                avatar_url: Some("https://example.com/avatar.png".to_string()),
            }),
            tokens: Some(AuthSessionTokens {
                access_token: "access-token".to_string(),
                refresh_token: "refresh-token".to_string(),
                expires_at: "2026-04-22T03:00:00Z".to_string(),
                scopes: vec![
                    "openid".to_string(),
                    "email".to_string(),
                    "profile".to_string(),
                    "offline_access".to_string(),
                ],
            }),
            status: None,
            error: None,
        };

        let session = match parse_auth_session_response(AuthProvider::Microsoft, response).unwrap()
        {
            PollAuthSession::Ready(session) => session,
            PollAuthSession::Pending => panic!("expected ready session"),
        };

        assert_eq!(session.provider, AuthProvider::Microsoft);
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

    #[test]
    fn provider_account_supports_microsoft() {
        assert_eq!(
            provider_account(AuthProvider::Microsoft),
            MICROSOFT_SESSION_ACCOUNT
        );
    }
}
