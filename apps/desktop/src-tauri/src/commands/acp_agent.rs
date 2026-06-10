/// ACP agent stdio spawner — system plumbing only.
///
/// Spawns an ACP-compatible agent binary with full stdio piping
/// (`stdin` + `stdout` + `stderr`) per the ACP transport spec:
///
///   - stdin/stdout: bidirectional JSON-RPC 2.0 (newline-delimited)
///   - stderr: agent logging (drained, forwarded to desktop logs)
///
/// All JSON-RPC protocol logic stays in TypeScript (`@tinker/host-service`).
/// This module only handles:
///   1. Process spawning with correct stdio configuration
///   2. Writing raw bytes to the agent's stdin
///   3. Draining stderr to prevent pipe-buffer deadlocks
///   4. Graceful + forceful shutdown (SIGTERM → SIGKILL)
///
/// The stdout pipe is consumed by the host-service Node.js process
/// via the Electron/Tauri IPC bridge — not by Rust.
use std::collections::HashMap;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tokio::task::spawn_blocking;

#[cfg(unix)]
use std::time::Duration;
#[cfg(unix)]
use tokio::time::sleep;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpSpawnConfig {
  pub cmd: String,
  pub args: Vec<String>,
  pub cwd: Option<String>,
  pub env: Option<HashMap<String, String>>,
  pub agent_id: String,
  pub agent_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpAgentHandle {
  pub pid: u32,
  pub agent_id: String,
  pub agent_name: String,
}

// ---------------------------------------------------------------------------
// Process registry
// ---------------------------------------------------------------------------

struct AgentProcess {
  child: Child,
  agent_id: String,
  agent_name: String,
}

static AGENTS: std::sync::LazyLock<Mutex<HashMap<u32, AgentProcess>>> =
  std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Spawn an ACP agent binary with full stdio piping.
///
/// Returns an `AcpAgentHandle` with the child PID. The host-service
/// (TypeScript) is responsible for speaking JSON-RPC over the stdio
/// channels.
#[tauri::command]
pub async fn spawn_acp_agent(
  _app: AppHandle,
  config: AcpSpawnConfig,
) -> Result<AcpAgentHandle, String> {
  let cmd = config.cmd.clone();
  let args = config.args.clone();
  let cwd = config.cwd.clone();
  let env = config.env.clone();
  let agent_id = config.agent_id.clone();
  let agent_name = config.agent_name.clone();

  let mut child = spawn_blocking(move || {
    let mut command = Command::new(&cmd);
    command
      .args(&args)
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped());

    if let Some(ref dir) = cwd {
      command.current_dir(dir);
    }

    if let Some(ref vars) = env {
      for (key, value) in vars {
        command.env(key, value);
      }
    }

    command.spawn().map_err(|e| format!("spawn ACP agent {cmd}: {e}"))
  })
  .await
  .map_err(|e| format!("spawn_blocking: {e}"))??;

  let pid = child.id();

  // Drain stderr in a background task to prevent pipe-buffer deadlocks.
  // Per ACP spec, stderr is for agent logging only — not protocol messages.
  let stderr = child
    .stderr
    .take()
    .ok_or_else(|| "failed to capture agent stderr".to_string());

  let agent_id_for_drain = agent_id.clone();
  if let Ok(stderr_stream) = stderr {
    std::thread::spawn(move || {
      use std::io::{BufRead, BufReader};
      let reader = BufReader::new(stderr_stream);
      for line in reader.lines() {
        match line {
          Ok(text) => {
            eprintln!("[acp:{agent_id_for_drain}:{pid}:stderr] {text}");
          }
          Err(_) => break,
        }
      }
    });
  }

  let handle = AcpAgentHandle {
    pid,
    agent_id: agent_id.clone(),
    agent_name: agent_name.clone(),
  };

  AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?.insert(
    pid,
    AgentProcess {
      child,
      agent_id,
      agent_name,
    },
  );

  Ok(handle)
}

/// Write raw bytes to an ACP agent's stdin.
///
/// The host-service TypeScript layer calls this to send JSON-RPC
/// messages (newline-delimited) to the agent process.
#[tauri::command]
pub async fn write_acp_stdin(
  _app: AppHandle,
  pid: u32,
  data: String,
) -> Result<(), String> {
  let data_bytes = data.into_bytes();

  spawn_blocking(move || {
    let mut agents = AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?;
    let process = agents
      .get_mut(&pid)
      .ok_or_else(|| format!("no ACP agent with pid {pid}"))?;

    let stdin = process
      .child
      .stdin
      .as_mut()
      .ok_or_else(|| format!("stdin not available for pid {pid}"))?;

    stdin
      .write_all(&data_bytes)
      .map_err(|e| format!("write stdin pid {pid}: {e}"))?;

    stdin.flush().map_err(|e| format!("flush stdin pid {pid}: {e}"))?;

    Ok(())
  })
  .await
  .map_err(|e| format!("spawn_blocking: {e}"))?
}

/// Stop an ACP agent process. Sends SIGTERM, waits briefly, then SIGKILL.
#[tauri::command]
pub async fn stop_acp_agent(_app: AppHandle, pid: u32) -> Result<(), String> {
  if pid == 0 {
    return Err("stop_acp_agent: pid must be non-zero".to_string());
  }

  let mut child = {
    let mut agents = AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?;
    match agents.remove(&pid) {
      Some(process) => process.child,
      None => return Ok(()), // already removed or never tracked
    }
  };

  // Close stdin to signal the agent we're done.
  drop(child.stdin.take());

  #[cfg(unix)]
  {
    // Send SIGTERM first.
    unsafe {
      libc::kill(pid as libc::pid_t, libc::SIGTERM);
    }

    // Wait up to 5s for graceful shutdown.
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);
    loop {
      match child.try_wait() {
        Ok(Some(_)) => return Ok(()),
        Ok(None) => {
          if tokio::time::Instant::now() >= deadline {
            break;
          }
          sleep(Duration::from_millis(100)).await;
        }
        Err(_) => break,
      }
    }

    // Force kill if still alive.
    let _ = child.kill();
    let _ = child.wait();
  }

  #[cfg(not(unix))]
  {
    let _ = child.kill();
    let _ = child.wait();
  }

  Ok(())
}

/// List all tracked ACP agent processes.
#[tauri::command]
pub async fn list_acp_agents(_app: AppHandle) -> Result<Vec<AcpAgentHandle>, String> {
  let agents = AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?;
  Ok(
    agents
      .iter()
      .map(|(pid, process)| AcpAgentHandle {
        pid: *pid,
        agent_id: process.agent_id.clone(),
        agent_name: process.agent_name.clone(),
      })
      .collect(),
  )
}

/// Stop all tracked ACP agents. Called during app shutdown.
pub async fn stop_all_acp_agents() -> Result<(), String> {
  let pids: Vec<u32> = {
    let agents = AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?;
    agents.keys().copied().collect()
  };

  let mut errors = Vec::new();
  for pid in pids {
    // We can't pass a real AppHandle here, but the commands don't use it
    // beyond type constraints. For internal cleanup, we extract the child
    // directly.
    let mut child = {
      let mut agents = AGENTS.lock().map_err(|e| format!("lock agents: {e}"))?;
      match agents.remove(&pid) {
        Some(process) => process.child,
        None => continue,
      }
    };

    drop(child.stdin.take());
    let _ = child.kill();
    if let Err(e) = child.wait() {
      errors.push(format!("pid {pid}: {e}"));
    }
  }

  if errors.is_empty() {
    Ok(())
  } else {
    Err(errors.join("\n"))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn acp_handle_serializes_camel_case() {
    let handle = AcpAgentHandle {
      pid: 42,
      agent_id: "goose".to_string(),
      agent_name: "Goose".to_string(),
    };
    let json = serde_json::to_string(&handle).unwrap();
    assert!(json.contains("\"pid\":42"));
    assert!(json.contains("\"agentId\":\"goose\""));
    assert!(json.contains("\"agentName\":\"Goose\""));
  }

  #[test]
  fn spawn_config_deserializes_camel_case() {
    let json = r#"{
      "cmd": "/usr/bin/goose",
      "args": ["--stdio"],
      "cwd": "/tmp",
      "env": {"FOO": "bar"},
      "agentId": "goose",
      "agentName": "Goose"
    }"#;
    let config: AcpSpawnConfig = serde_json::from_str(json).unwrap();
    assert_eq!(config.cmd, "/usr/bin/goose");
    assert_eq!(config.args, vec!["--stdio"]);
    assert_eq!(config.cwd.as_deref(), Some("/tmp"));
    assert_eq!(config.agent_id, "goose");
  }
}
