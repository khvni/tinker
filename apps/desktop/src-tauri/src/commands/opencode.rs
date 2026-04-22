use std::{
  fs,
  io::ErrorKind,
  path::{Path, PathBuf},
  process::Command,
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::{spawn, Receiver};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::time::{sleep, timeout, Duration, Instant};

const HEALTH_POLL_INTERVAL: Duration = Duration::from_millis(100);
const HEALTH_POLL_TIMEOUT: Duration = Duration::from_secs(10);
const LISTEN_ANNOUNCE_TIMEOUT: Duration = Duration::from_secs(10);
const GRACEFUL_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(2);
const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(50);
const OPENCODE_SERVER_USERNAME: &str = "tinker";

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeHandle {
  pub base_url: String,
  pub pid: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeManifest {
  pub pid: u32,
  pub port: u16,
  pub secret: String,
  pub folder_path: String,
  pub user_id: String,
  pub memory_subdir: String,
  pub base_url: String,
  pub session_id: String,
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
}

pub(crate) fn manifests_dir(home: &PathBuf) -> Result<PathBuf, String> {
  let dir = home.join(".tinker").join("manifests");
  fs::create_dir_all(&dir).map_err(|e| format!("create manifests dir {dir:?}: {e}"))?;
  Ok(dir)
}

fn remove_manifest(path: &Path) -> Result<(), String> {
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
    Err(error) => Err(format!("remove manifest {path:?}: {error}")),
  }
}

fn list_manifests(manifests_dir: &Path) -> Result<Vec<(PathBuf, OpencodeManifest)>, String> {
  let entries = match fs::read_dir(manifests_dir) {
    Ok(entries) => entries,
    Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
    Err(error) => return Err(format!("read {manifests_dir:?}: {error}")),
  };

  let mut manifests = Vec::new();

  // Other sidecars (auth-sidecar, etc.) share this manifest directory with
  // their own schemas. Skip their files by name rather than attempting to
  // parse them as OpencodeManifest.
  const FOREIGN_MANIFESTS: &[&str] = &["auth-sidecar.json"];

  for entry in entries {
    let entry = entry.map_err(|error| format!("iter {manifests_dir:?}: {error}"))?;
    let path = entry.path();
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
      continue;
    }
    if path
      .file_name()
      .and_then(|value| value.to_str())
      .is_some_and(|name| FOREIGN_MANIFESTS.contains(&name))
    {
      continue;
    }

    let content = match fs::read_to_string(&path) {
      Ok(content) => content,
      Err(error) => {
        eprintln!("[opencode] could not read manifest {path:?}: {error}");
        continue;
      }
    };

    match serde_json::from_str::<OpencodeManifest>(&content) {
      Ok(manifest) => manifests.push((path, manifest)),
      Err(error) => {
        // Don't delete — the file might belong to a schema we don't recognize
        // yet (newer/older app version). Log and skip; stale opencode
        // manifests are pruned by reconcile when their pid no longer exists.
        eprintln!("[opencode] skipping unrecognised manifest {path:?}: {error}");
      }
    }
  }

  Ok(manifests)
}

pub(crate) fn extract_base_url(line: &[u8]) -> Option<String> {
  let text = String::from_utf8_lossy(line);
  let start = text.find("http://127.0.0.1:")?;
  let candidate = text[start..].split_whitespace().next()?;
  Some(candidate.to_string())
}

async fn wait_for_health(base_url: &str, user: &str, secret: &str) -> Result<(), String> {
  let client = reqwest::Client::new();
  let url = format!("{base_url}/health");
  let deadline = Instant::now() + HEALTH_POLL_TIMEOUT;

  loop {
    if let Ok(response) = client.get(&url).basic_auth(user, Some(secret)).send().await {
      if response.status().is_success() {
        return Ok(());
      }
    }

    if Instant::now() >= deadline {
      return Err(format!(
        "opencode /health did not respond within {}s",
        HEALTH_POLL_TIMEOUT.as_secs()
      ));
    }
    sleep(HEALTH_POLL_INTERVAL).await;
  }
}

async fn wait_for_listening(rx: &mut Receiver<CommandEvent>) -> Result<String, String> {
  let deadline = Instant::now() + LISTEN_ANNOUNCE_TIMEOUT;

  loop {
    let remaining = deadline
      .checked_duration_since(Instant::now())
      .ok_or_else(|| "opencode did not announce a listening URL within 10s".to_string())?;

    let event = timeout(remaining, rx.recv())
      .await
      .map_err(|_| "opencode did not announce a listening URL within 10s".to_string())?
      .ok_or_else(|| "opencode exited before announcing a listening URL".to_string())?;

    match event {
      CommandEvent::Stdout(line) => {
        eprintln!("[opencode] {}", String::from_utf8_lossy(&line));
        if let Some(url) = extract_base_url(&line) {
          return Ok(url);
        }
      }
      CommandEvent::Stderr(line) => {
        eprintln!("[opencode:error] {}", String::from_utf8_lossy(&line));
      }
      CommandEvent::Terminated(payload) => {
        return Err(format!(
          "opencode exited before becoming ready (code {:?}, signal {:?})",
          payload.code, payload.signal
        ));
      }
      _ => {}
    }
  }
}

#[tauri::command]
pub async fn start_opencode(
  app: AppHandle,
  folder_path: String,
  user_id: String,
  memory_subdir: String,
) -> Result<OpencodeHandle, String> {
  if folder_path.is_empty() {
    return Err("folder_path must not be empty".to_string());
  }
  if user_id.is_empty() {
    return Err("user_id must not be empty".to_string());
  }

  let session_id = random_url_safe(16);
  let username = OPENCODE_SERVER_USERNAME.to_string();
  let secret = random_url_safe(24);
  let home = app
    .path()
    .home_dir()
    .map_err(|e| format!("resolve home dir: {e}"))?;

  let (mut rx, child) = app
    .shell()
    .sidecar("opencode")
    .map_err(|e| e.to_string())?
    // `opencode serve` no longer accepts `--cwd` (removed upstream). The
    // working directory is set via `.current_dir(&folder_path)` below, which
    // is the supported path.
    .args(["serve", "--hostname", "127.0.0.1", "--port", "0"])
    .envs([
      ("OPENCODE_SERVER_USERNAME", username.clone()),
      ("OPENCODE_SERVER_PASSWORD", secret.clone()),
      ("SMART_VAULT_PATH", memory_subdir.clone()),
    ])
    .current_dir(PathBuf::from(&folder_path))
    .spawn()
    .map_err(|e| format!("spawn opencode: {e}"))?;

  let pid = child.pid();

  let base_url = match wait_for_listening(&mut rx).await {
    Ok(url) => url,
    Err(error) => {
      let _ = child.kill();
      return Err(error);
    }
  };

  if let Err(error) = wait_for_health(&base_url, &username, &secret).await {
    let _ = child.kill();
    return Err(error);
  }

  let port: u16 = base_url
    .rsplit(':')
    .next()
    .and_then(|p| p.parse().ok())
    .ok_or_else(|| format!("could not parse port from base url {base_url}"))?;

  let manifest = OpencodeManifest {
    pid,
    port,
    secret: secret.clone(),
    folder_path,
    user_id,
    memory_subdir,
    base_url: base_url.clone(),
    session_id: session_id.clone(),
  };
  let manifest_path = manifests_dir(&home)?.join(format!("{session_id}.json"));
  let manifest_json = serde_json::to_string_pretty(&manifest)
    .map_err(|e| format!("serialize manifest: {e}"))?;
  fs::write(&manifest_path, manifest_json)
    .map_err(|e| format!("write manifest {manifest_path:?}: {e}"))?;
  // Manifest contains the basic-auth secret; restrict to owner on unix.
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    let perms = std::fs::Permissions::from_mode(0o600);
    fs::set_permissions(&manifest_path, perms)
      .map_err(|e| format!("chmod manifest {manifest_path:?}: {e}"))?;
  }

  // Move child into a detached drain task. Dropping `CommandChild` does not
  // signal the process (tauri-plugin-shell uses shared-child), so the opencode
  // process survives app quit. The task keeps stdout/stderr pipes flowing so
  // the child never blocks on a full pipe buffer.
  spawn(async move {
    let _detached = child;
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(line) => {
          eprintln!("[opencode:{pid}] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Stderr(line) => {
          eprintln!("[opencode:{pid}:error] {}", String::from_utf8_lossy(&line));
        }
        CommandEvent::Terminated(payload) => {
          eprintln!(
            "[opencode:{pid}] terminated code={:?} signal={:?}",
            payload.code, payload.signal
          );
          break;
        }
        _ => {}
      }
    }
  });

  Ok(OpencodeHandle { base_url, pid })
}

#[cfg(unix)]
fn process_alive(pid: u32) -> bool {
  // `kill(pid, 0)` performs permission checks without sending a signal.
  // Returns 0 if the process exists (and we may signal it). On failure,
  // ESRCH means the pid is gone; anything else (e.g. EPERM) implies the
  // process still exists but we cannot signal it — treat as alive.
  let res = unsafe { libc::kill(pid as libc::pid_t, 0) };
  if res == 0 {
    true
  } else {
    std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
  }
}

#[cfg(unix)]
fn send_unix_signal(pid: u32, signal: libc::c_int) -> Result<(), String> {
  let res = unsafe { libc::kill(pid as libc::pid_t, signal) };
  if res == 0 {
    return Ok(());
  }
  let err = std::io::Error::last_os_error();
  // Process already exited between the caller's check and our kill call —
  // idempotent stop, not an error.
  if err.raw_os_error() == Some(libc::ESRCH) {
    return Ok(());
  }
  Err(format!("kill(pid={pid}, signal={signal}): {err}"))
}

#[cfg(unix)]
fn send_term(pid: u32) -> Result<(), String> {
  send_unix_signal(pid, libc::SIGTERM)
}

#[cfg(unix)]
fn send_kill(pid: u32) -> Result<(), String> {
  send_unix_signal(pid, libc::SIGKILL)
}

#[cfg(not(unix))]
compile_error!("stop_opencode is unix-only for MVP (macOS + Linux). See decisions.md D25.");

fn remove_manifest_for_pid(manifests_dir: &Path, pid: u32) -> Result<(), String> {
  for (path, manifest) in list_manifests(manifests_dir)? {
    if manifest.pid == pid {
      remove_manifest(&path)?;
      return Ok(());
    }
  }
  Ok(())
}

async fn stop_opencode_inner(manifests_dir: PathBuf, pid: u32) -> Result<(), String> {
  // 1. Ask the process to exit. No-op if it's already gone.
  send_term(pid)?;

  // 2. Wait up to GRACEFUL_SHUTDOWN_TIMEOUT for a clean exit.
  let deadline = Instant::now() + GRACEFUL_SHUTDOWN_TIMEOUT;
  while Instant::now() < deadline {
    if !process_alive(pid) {
      break;
    }
    sleep(PROCESS_POLL_INTERVAL).await;
  }

  // 3. Force-kill if still running after the grace period.
  if process_alive(pid) {
    send_kill(pid)?;
  }

  // 4. Remove the manifest file keyed by pid. No match = already cleaned.
  remove_manifest_for_pid(&manifests_dir, pid)?;

  Ok(())
}

#[cfg(unix)]
fn listener_pid_for_port(port: u16) -> Result<Option<u32>, String> {
  let port_arg = format!("-iTCP:{port}");

  for binary in ["lsof", "/usr/sbin/lsof", "/usr/bin/lsof"] {
    let output = match Command::new(binary)
      .args(["-nP", &port_arg, "-sTCP:LISTEN", "-Fp"])
      .output()
    {
      Ok(output) => output,
      Err(error) if error.kind() == ErrorKind::NotFound => continue,
      Err(error) => return Err(format!("run {binary}: {error}")),
    };

    if !output.status.success() && output.stdout.is_empty() {
      if output.stderr.is_empty() {
        return Ok(None);
      }
      return Err(format!(
        "{binary} failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
      ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let pid = stdout
      .lines()
      .find_map(|line| line.strip_prefix('p'))
      .and_then(|value| value.parse::<u32>().ok());
    return Ok(pid);
  }

  Err("lsof not found while reconciling opencode manifests".to_string())
}

#[cfg(unix)]
async fn reconcile_manifest_entry(manifests_dir: &Path, path: PathBuf, manifest: OpencodeManifest) -> Result<(), String> {
  if manifest.pid == 0 || !process_alive(manifest.pid) {
    return remove_manifest(&path);
  }

  match listener_pid_for_port(manifest.port) {
    Ok(Some(pid)) if pid == manifest.pid => {
      if let Err(error) = wait_for_health(&manifest.base_url, OPENCODE_SERVER_USERNAME, &manifest.secret).await {
        eprintln!(
          "[opencode:{}] orphan manifest health check failed: {error}",
          manifest.pid
        );
      }

      stop_opencode_inner(manifests_dir.to_path_buf(), manifest.pid)
        .await
        .map_err(|error| format!("stop unhealthy orphan {:?}: {error}", path))
    }
    Ok(_) => remove_manifest(&path),
    Err(error) => {
      eprintln!(
        "[opencode:{}] could not verify port ownership for manifest {:?}: {error}",
        manifest.pid, path
      );
      match wait_for_health(&manifest.base_url, OPENCODE_SERVER_USERNAME, &manifest.secret).await {
        Ok(()) => stop_opencode_inner(manifests_dir.to_path_buf(), manifest.pid)
          .await
          .map_err(|stop_error| format!("stop adopted manifest {:?}: {stop_error}", path)),
        Err(_) => remove_manifest(&path),
      }
    }
  }
}

async fn reconcile_manifests_inner(manifests_dir: PathBuf) -> Result<(), String> {
  let manifests = list_manifests(&manifests_dir)?;
  let mut errors = Vec::new();

  for (path, manifest) in manifests {
    if let Err(error) = reconcile_manifest_entry(&manifests_dir, path.clone(), manifest).await {
      let _ = remove_manifest(&path);
      errors.push(error);
    }
  }

  if errors.is_empty() {
    Ok(())
  } else {
    Err(errors.join("\n"))
  }
}

async fn stop_all_manifests_inner(manifests_dir: PathBuf) -> Result<(), String> {
  let manifests = list_manifests(&manifests_dir)?;
  let mut errors = Vec::new();

  for (_, manifest) in manifests {
    if manifest.pid == 0 {
      continue;
    }

    if let Err(error) = stop_opencode_inner(manifests_dir.clone(), manifest.pid).await {
      errors.push(format!("pid {}: {error}", manifest.pid));
    }
  }

  if errors.is_empty() {
    Ok(())
  } else {
    Err(errors.join("\n"))
  }
}

pub async fn reconcile_opencode_manifests(app: &AppHandle) -> Result<(), String> {
  let home = app
    .path()
    .home_dir()
    .map_err(|error| format!("resolve home dir: {error}"))?;
  let manifests = manifests_dir(&home)?;
  reconcile_manifests_inner(manifests).await
}

pub async fn stop_all_opencodes(app: &AppHandle) -> Result<(), String> {
  let home = app
    .path()
    .home_dir()
    .map_err(|error| format!("resolve home dir: {error}"))?;
  let manifests = manifests_dir(&home)?;
  stop_all_manifests_inner(manifests).await
}

#[tauri::command]
pub async fn stop_opencode(app: AppHandle, pid: u32) -> Result<(), String> {
  // kill(2) treats pid <= 0 as "broadcast to process group." Reject at the
  // boundary so a renderer bug can never terminate unrelated processes.
  if pid == 0 {
    return Err("stop_opencode: pid must be non-zero".to_string());
  }
  let home = app
    .path()
    .home_dir()
    .map_err(|e| format!("resolve home dir: {e}"))?;
  let manifests = manifests_dir(&home)?;
  stop_opencode_inner(manifests, pid).await
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn extract_base_url_parses_listening_line() {
    let line = b"opencode server listening on http://127.0.0.1:53821\n";
    assert_eq!(
      extract_base_url(line),
      Some("http://127.0.0.1:53821".to_string())
    );
  }

  #[test]
  fn extract_base_url_returns_none_without_match() {
    let line = b"starting up\n";
    assert_eq!(extract_base_url(line), None);
  }

  #[test]
  fn manifest_roundtrips() {
    let manifest = OpencodeManifest {
      pid: 12345,
      port: 53821,
      secret: "secret".into(),
      folder_path: "/tmp/vault".into(),
      user_id: "user-1".into(),
      memory_subdir: "/tmp/memory/user-1".into(),
      base_url: "http://127.0.0.1:53821".into(),
      session_id: "sess-abc".into(),
    };
    let json = serde_json::to_string(&manifest).unwrap();
    let parsed: OpencodeManifest = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, manifest);
  }

  #[test]
  fn manifests_dir_is_created_under_home() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let dir = manifests_dir(&tmp.path().to_path_buf()).expect("manifests dir");
    assert!(dir.exists());
    assert!(dir.ends_with(".tinker/manifests"));
  }

  #[test]
  fn handle_serializes_camel_case() {
    let handle = OpencodeHandle {
      base_url: "http://127.0.0.1:1".into(),
      pid: 42,
    };
    let json = serde_json::to_string(&handle).unwrap();
    assert!(json.contains("\"baseUrl\":\"http://127.0.0.1:1\""));
    assert!(json.contains("\"pid\":42"));
  }

  #[cfg(unix)]
  #[test]
  fn manifest_permissions_are_owner_only() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().expect("tempdir");
    let path = tmp.path().join("m.json");
    fs::write(&path, "{}").unwrap();
    fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();
    let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o600);
  }

  fn write_manifest(dir: &Path, session_id: &str, pid: u32) -> PathBuf {
    let manifest = OpencodeManifest {
      pid,
      port: 1,
      secret: "s".into(),
      folder_path: "/tmp".into(),
      user_id: "u".into(),
      memory_subdir: "/tmp/u".into(),
      base_url: "http://127.0.0.1:1".into(),
      session_id: session_id.into(),
    };
    let path = dir.join(format!("{session_id}.json"));
    fs::write(&path, serde_json::to_string(&manifest).unwrap()).unwrap();
    path
  }

  #[test]
  fn remove_manifest_for_pid_removes_matching_only() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let keep = write_manifest(tmp.path(), "keep", 100);
    let drop = write_manifest(tmp.path(), "drop", 200);

    remove_manifest_for_pid(tmp.path(), 200).expect("remove");

    assert!(keep.exists(), "unrelated manifest survives");
    assert!(!drop.exists(), "matching manifest is removed");
  }

  #[test]
  fn remove_manifest_for_pid_is_idempotent_when_no_match() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let keep = write_manifest(tmp.path(), "keep", 100);

    remove_manifest_for_pid(tmp.path(), 999).expect("ok on miss");

    assert!(keep.exists());
  }

  #[test]
  fn remove_manifest_for_pid_ignores_missing_dir() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let missing = tmp.path().join("does-not-exist");
    remove_manifest_for_pid(&missing, 42).expect("missing dir is ok");
  }

  #[test]
  fn remove_manifest_for_pid_skips_malformed_files() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let bogus = tmp.path().join("bogus.json");
    fs::write(&bogus, "{not json").unwrap();
    let target = write_manifest(tmp.path(), "sess", 7);

    remove_manifest_for_pid(tmp.path(), 7).expect("remove");

    assert!(bogus.exists(), "unrecognised files are left in place, not deleted");
    assert!(!target.exists());
  }

  #[test]
  fn list_manifests_skips_foreign_sidecar_files() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let auth_manifest = tmp.path().join("auth-sidecar.json");
    fs::write(&auth_manifest, r#"{"pid":1,"port":3147,"secret":"s","baseUrl":"http://127.0.0.1:3147"}"#).unwrap();
    let opencode_manifest = write_manifest(tmp.path(), "sess", 11);

    let manifests = list_manifests(tmp.path()).expect("list");

    assert_eq!(manifests.len(), 1, "only opencode manifests returned");
    assert!(auth_manifest.exists(), "foreign sidecar file is preserved");
    assert!(opencode_manifest.exists());
  }

  #[cfg(unix)]
  #[tokio::test]
  async fn reconcile_manifests_inner_removes_dead_pid_manifest() {
    use std::process::{Command, Stdio};

    let tmp = tempfile::tempdir().expect("tempdir");
    let mut child = Command::new("true")
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn true");
    let pid = child.id();
    let manifest_path = write_manifest(tmp.path(), "dead", pid);
    child.wait().expect("reap");

    reconcile_manifests_inner(tmp.path().to_path_buf())
      .await
      .expect("reconcile succeeds");

    assert!(!manifest_path.exists(), "dead pid manifest removed");
  }

  #[cfg(unix)]
  #[tokio::test]
  async fn stop_all_manifests_inner_stops_every_manifest_pid() {
    use std::process::{Command, Stdio};

    let tmp = tempfile::tempdir().expect("tempdir");

    let mut first = Command::new("sleep")
      .arg("30")
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn first sleep");
    let first_pid = first.id();
    let first_manifest = write_manifest(tmp.path(), "first", first_pid);

    let mut second = Command::new("sleep")
      .arg("30")
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn second sleep");
    let second_pid = second.id();
    let second_manifest = write_manifest(tmp.path(), "second", second_pid);

    stop_all_manifests_inner(tmp.path().to_path_buf())
      .await
      .expect("stop all manifests");

    let _ = first.wait();
    let _ = second.wait();

    assert!(!process_alive(first_pid), "first process stopped");
    assert!(!process_alive(second_pid), "second process stopped");
    assert!(!first_manifest.exists(), "first manifest removed");
    assert!(!second_manifest.exists(), "second manifest removed");
  }

  #[cfg(unix)]
  #[tokio::test]
  async fn stop_opencode_inner_is_idempotent_for_dead_pid() {
    use std::process::{Command, Stdio};

    let tmp = tempfile::tempdir().expect("tempdir");
    // Spawn + reap a real child so its pid is guaranteed no longer alive,
    // then try stopping it. PID 0 and negative values are forbidden because
    // `kill(2)` treats them as broadcast to the process group.
    let mut child = Command::new("true")
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn true");
    let pid = child.id();
    child.wait().expect("reap");
    assert!(!process_alive(pid), "helper already exited");

    stop_opencode_inner(tmp.path().to_path_buf(), pid)
      .await
      .expect("idempotent stop");
  }

  #[cfg(unix)]
  #[tokio::test]
  async fn stop_opencode_inner_terminates_live_process_and_removes_manifest() {
    use std::process::{Command, Stdio};

    let tmp = tempfile::tempdir().expect("tempdir");
    let mut child = Command::new("sleep")
      .arg("30")
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn sleep");
    let pid = child.id();
    let manifest_path = write_manifest(tmp.path(), "live", pid);

    stop_opencode_inner(tmp.path().to_path_buf(), pid)
      .await
      .expect("stop");

    // Reap the zombie so the test doesn't leak.
    let _ = child.wait();

    assert!(!process_alive(pid), "process is gone");
    assert!(!manifest_path.exists(), "manifest removed");
  }

  #[cfg(unix)]
  #[tokio::test]
  async fn stop_opencode_inner_force_kills_process_that_ignores_sigterm() {
    use std::process::{Command, Stdio};

    let tmp = tempfile::tempdir().expect("tempdir");
    // A shell that traps SIGTERM and keeps running forces the SIGKILL path.
    let mut child = Command::new("sh")
      .args(["-c", "trap '' TERM; sleep 30"])
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .spawn()
      .expect("spawn trapping shell");
    let pid = child.id();

    stop_opencode_inner(tmp.path().to_path_buf(), pid)
      .await
      .expect("stop");
    let _ = child.wait();

    assert!(!process_alive(pid), "SIGKILL fallback killed the process");
  }
}
