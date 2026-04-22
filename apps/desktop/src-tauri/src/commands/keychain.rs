use tauri::{AppHandle, Runtime};
use tauri_plugin_keyring::KeyringExt;

use crate::commands::auth::{keyring_error, KEYRING_SERVICE};

trait PasswordStore {
  fn get_password(&self, service: &str, account: &str) -> Result<Option<String>, String>;
  fn set_password(&self, service: &str, account: &str, password: &str) -> Result<(), String>;
  fn delete_password(&self, service: &str, account: &str) -> Result<(), String>;
}

struct AppPasswordStore<'a, R: Runtime> {
  app: &'a AppHandle<R>,
}

impl<R: Runtime> PasswordStore for AppPasswordStore<'_, R> {
  fn get_password(&self, service: &str, account: &str) -> Result<Option<String>, String> {
    self.app
      .keyring()
      .get_password(service, account)
      .map_err(keyring_error)
  }

  fn set_password(&self, service: &str, account: &str, password: &str) -> Result<(), String> {
    self.app
      .keyring()
      .set_password(service, account, password)
      .map_err(keyring_error)
  }

  fn delete_password(&self, service: &str, account: &str) -> Result<(), String> {
    self.app
      .keyring()
      .delete_password(service, account)
      .map_err(keyring_error)
  }
}

fn require_key_segment(label: &str, value: &str) -> Result<String, String> {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return Err(format!("{label} is required."));
  }

  Ok(trimmed.to_string())
}

fn refresh_token_account(provider: &str, user_id: &str) -> Result<String, String> {
  let provider = require_key_segment("Provider", provider)?;
  let user_id = require_key_segment("User ID", user_id)?;
  Ok(format!("{KEYRING_SERVICE}.{provider}.{user_id}"))
}

fn save_refresh_token_with_store(
  store: &impl PasswordStore,
  provider: &str,
  user_id: &str,
  token: &str,
) -> Result<(), String> {
  if token.trim().is_empty() {
    return Err("Token is required.".to_string());
  }

  let account = refresh_token_account(provider, user_id)?;
  store.set_password(KEYRING_SERVICE, &account, token)
}

fn load_refresh_token_with_store(
  store: &impl PasswordStore,
  provider: &str,
  user_id: &str,
) -> Result<Option<String>, String> {
  let account = refresh_token_account(provider, user_id)?;
  store.get_password(KEYRING_SERVICE, &account)
}

fn clear_refresh_token_with_store(
  store: &impl PasswordStore,
  provider: &str,
  user_id: &str,
) -> Result<(), String> {
  let account = refresh_token_account(provider, user_id)?;
  if store.get_password(KEYRING_SERVICE, &account)?.is_none() {
    return Ok(());
  }

  store.delete_password(KEYRING_SERVICE, &account)
}

#[tauri::command]
pub fn save_refresh_token<R: Runtime>(
  app: AppHandle<R>,
  provider: String,
  user_id: String,
  token: String,
) -> Result<(), String> {
  save_refresh_token_with_store(&AppPasswordStore { app: &app }, &provider, &user_id, &token)
}

#[tauri::command]
pub fn load_refresh_token<R: Runtime>(
  app: AppHandle<R>,
  provider: String,
  user_id: String,
) -> Result<Option<String>, String> {
  load_refresh_token_with_store(&AppPasswordStore { app: &app }, &provider, &user_id)
}

#[tauri::command]
pub fn clear_refresh_token<R: Runtime>(
  app: AppHandle<R>,
  provider: String,
  user_id: String,
) -> Result<(), String> {
  clear_refresh_token_with_store(&AppPasswordStore { app: &app }, &provider, &user_id)
}

#[cfg(test)]
mod tests {
  use std::{
    collections::HashMap,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
  };

  use super::*;

  #[derive(Default)]
  struct MemoryPasswordStore {
    entries: Mutex<HashMap<(String, String), String>>,
  }

  impl PasswordStore for MemoryPasswordStore {
    fn get_password(&self, service: &str, account: &str) -> Result<Option<String>, String> {
      let entries = self.entries.lock().map_err(|_| "Password store lock was poisoned.".to_string())?;
      Ok(entries.get(&(service.to_string(), account.to_string())).cloned())
    }

    fn set_password(&self, service: &str, account: &str, password: &str) -> Result<(), String> {
      let mut entries = self.entries.lock().map_err(|_| "Password store lock was poisoned.".to_string())?;
      entries.insert((service.to_string(), account.to_string()), password.to_string());
      Ok(())
    }

    fn delete_password(&self, service: &str, account: &str) -> Result<(), String> {
      let mut entries = self.entries.lock().map_err(|_| "Password store lock was poisoned.".to_string())?;
      entries.remove(&(service.to_string(), account.to_string()));
      Ok(())
    }
  }

  #[test]
  fn refresh_token_account_uses_tinker_prefix() {
    assert_eq!(
      refresh_token_account("google", "user-123").unwrap(),
      "tinker.google.user-123"
    );
  }

  #[test]
  fn refresh_token_commands_round_trip_with_store() {
    let store = MemoryPasswordStore::default();

    save_refresh_token_with_store(&store, "github", "user-42", "refresh-token").unwrap();
    assert_eq!(
      load_refresh_token_with_store(&store, "github", "user-42").unwrap(),
      Some("refresh-token".to_string())
    );

    clear_refresh_token_with_store(&store, "github", "user-42").unwrap();
    assert_eq!(load_refresh_token_with_store(&store, "github", "user-42").unwrap(), None);
  }

  #[test]
  fn refresh_token_commands_reject_blank_segments() {
    let store = MemoryPasswordStore::default();

    assert_eq!(
      save_refresh_token_with_store(&store, " ", "user-42", "refresh-token").unwrap_err(),
      "Provider is required."
    );
    assert_eq!(
      load_refresh_token_with_store(&store, "google", " ").unwrap_err(),
      "User ID is required."
    );
    assert_eq!(
      save_refresh_token_with_store(&store, "google", "user-42", " ").unwrap_err(),
      "Token is required."
    );
  }

  #[cfg(any(target_os = "macos", target_os = "linux"))]
  #[test]
  #[ignore = "Touches the host OS keychain backend."]
  fn refresh_token_commands_round_trip_in_os_keychain() {
    let nonce = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("system time")
      .as_nanos();
    let provider = "google";
    let user_id = format!("test-user-{nonce}");
    let token = format!("refresh-token-{nonce}");
    let account = refresh_token_account(provider, &user_id).unwrap();
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).expect("keyring entry");

    let _ = entry.delete_credential();
    entry.set_password(&token).expect("save refresh token");
    assert_eq!(entry.get_password().expect("load refresh token"), token);
    entry.delete_credential().expect("clear refresh token");
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
  }
}
