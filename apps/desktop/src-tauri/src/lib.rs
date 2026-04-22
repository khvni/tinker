mod commands;

use tauri::{Manager, RunEvent};
use tauri_plugin_keyring::KeyringExt;

use crate::commands::auth::{AuthProvider, BetterAuthState, SSOSession, KEYRING_SERVICE};

const TINKER_GITHUB_AUTHORIZATION_ENV: &str = "TINKER_GITHUB_AUTHORIZATION";
const TINKER_LINEAR_AUTHORIZATION_ENV: &str = "TINKER_LINEAR_AUTHORIZATION";
const LINEAR_API_TOKEN_ENV_NAMES: [&str; 2] = ["TINKER_LINEAR_API_TOKEN", "LINEAR_API_TOKEN"];

fn read_keychain_session(
    app: &tauri::AppHandle,
    provider: AuthProvider,
) -> Result<Option<SSOSession>, String> {
    let account = match provider {
        AuthProvider::Google => crate::commands::auth::GOOGLE_SESSION_ACCOUNT,
        AuthProvider::Github => crate::commands::auth::GITHUB_SESSION_ACCOUNT,
        AuthProvider::Microsoft => crate::commands::auth::MICROSOFT_SESSION_ACCOUNT,
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

fn first_non_empty_scope<'a>(scopes: &'a [String], candidates: &[&'a str]) -> Option<&'a str> {
    scopes.iter().find_map(|scope| {
        let normalized = scope.trim();
        if normalized.is_empty() {
            return None;
        }

        candidates
            .iter()
            .copied()
            .find(|candidate| normalized == *candidate)
    })
}

fn github_session_supports_mcp(session: &SSOSession) -> bool {
    first_non_empty_scope(session.scopes(), &["repo", "public_repo"]).is_some()
}

fn bearer_authorization(token: &str) -> Option<String> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(format!("Bearer {trimmed}"))
}

fn env_token_authorization(var_names: &[&str]) -> Option<String> {
    var_names
        .iter()
        .find_map(|name| std::env::var(name).ok())
        .and_then(|token| bearer_authorization(&token))
}

fn main_window_config(
    app: &tauri::AppHandle,
) -> Result<&tauri::utils::config::WindowConfig, String> {
    app.config()
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

    tauri::WebviewWindowBuilder::from_config(
        app,
        main_window_config(app).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?
    .build()
    .map_err(|error| error.to_string())?;

    Ok(())
}

async fn boot_home_opencode(app: &tauri::AppHandle) -> Result<(), String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| format!("resolve home dir: {error}"))?;
    let memory_subdir = commands::opencode::manifests_dir(&home)?
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string();
    let _ = commands::opencode::start_opencode(
        app.clone(),
        home.to_string_lossy().into_owned(),
        "guest".to_string(),
        memory_subdir,
    )
    .await?;
    Ok(())
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
        .invoke_handler(tauri::generate_handler![
            commands::auth::start_auth_sidecar,
            commands::auth::auth_sign_in,
            commands::auth::restore_auth_session,
            commands::auth::auth_sign_out,
            commands::auth::auth_status,
            commands::dialog::open_folder_picker,
            commands::keychain::save_refresh_token,
            commands::keychain::load_refresh_token,
            commands::keychain::clear_refresh_token,
            commands::memory::memory_approve,
            commands::memory::memory_dismiss,
            commands::memory::memory_diff,
            commands::opencode::start_opencode,
            commands::opencode::stop_opencode
        ])
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                if let Err(error) =
                    commands::opencode::reconcile_opencode_manifests(&app.handle()).await
                {
                    eprintln!("[opencode] orphan manifest cleanup failed: {error}");
                }
                boot_home_opencode(&app.handle()).await?;
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
            if let Err(error) =
                tauri::async_runtime::block_on(commands::opencode::stop_all_opencodes(&handle))
            {
                eprintln!("[opencode] stop-all cleanup failed: {error}");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn github_session(scopes: &[&str]) -> SSOSession {
        SSOSession::for_test(AuthProvider::Github, scopes)
    }

    #[test]
    fn github_session_supports_repo_scopes() {
        assert!(github_session_supports_mcp(&github_session(&[
            "read:user",
            "repo"
        ])));
        assert!(github_session_supports_mcp(&github_session(&[
            "public_repo"
        ])));
    }

    #[test]
    fn github_session_rejects_identity_only_scopes() {
        assert!(!github_session_supports_mcp(&github_session(&[
            "read:user",
            "user:email"
        ])));
    }

    #[test]
    fn bearer_authorization_requires_non_empty_token() {
        assert_eq!(
            bearer_authorization("  ghp_123  "),
            Some("Bearer ghp_123".to_string())
        );
        assert_eq!(bearer_authorization("   "), None);
    }
}
