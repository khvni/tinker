use std::collections::HashMap;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::{
  io::{AsyncReadExt, AsyncWriteExt},
  net::TcpListener,
  time::{timeout, Duration as TokioDuration},
};
use url::Url;

const OPENAI_OAUTH_ISSUER: &str = "https://auth.openai.com";
const OPENAI_OAUTH_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_OAUTH_SCOPE: &str = "openid profile email offline_access";

#[derive(Deserialize)]
struct CodexTokenResponse {
  access_token: String,
}

fn random_url_safe(bytes: usize) -> String {
  let mut buffer = vec![0_u8; bytes];
  OsRng.fill_bytes(&mut buffer);
  URL_SAFE_NO_PAD.encode(buffer)
}

fn pkce_challenge(verifier: &str) -> String {
  let digest = Sha256::digest(verifier.as_bytes());
  URL_SAFE_NO_PAD.encode(digest)
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

async fn read_authorization_code(state: &str, challenge: &str) -> Result<(String, String), String> {
  let listener = TcpListener::bind("127.0.0.1:0")
    .await
    .map_err(|error| error.to_string())?;
  let redirect_uri = format!(
    "http://127.0.0.1:{}/callback",
    listener.local_addr().map_err(|error| error.to_string())?.port()
  );

  let auth_url = Url::parse_with_params(
    &format!("{OPENAI_OAUTH_ISSUER}/oauth/authorize"),
    &[
      ("response_type", "code".to_string()),
      ("client_id", OPENAI_OAUTH_CLIENT_ID.to_string()),
      ("redirect_uri", redirect_uri.clone()),
      ("scope", OPENAI_OAUTH_SCOPE.to_string()),
      ("code_challenge", challenge.to_string()),
      ("code_challenge_method", "S256".to_string()),
      ("id_token_add_organizations", "true".to_string()),
      ("codex_cli_simplified_flow", "true".to_string()),
      ("originator", "opencode".to_string()),
      ("state", state.to_string()),
    ],
  )
  .map_err(|error| error.to_string())?;

  webbrowser::open(auth_url.as_str()).map_err(|error| error.to_string())?;

  let (mut stream, _) = timeout(TokioDuration::from_secs(180), listener.accept())
    .await
    .map_err(|_| "Timed out waiting for the Codex OAuth callback.".to_string())?
    .map_err(|error| error.to_string())?;

  let mut buffer = [0_u8; 8192];
  let bytes_read = stream
    .read(&mut buffer)
    .await
    .map_err(|error| error.to_string())?;
  let request = String::from_utf8_lossy(&buffer[..bytes_read]);
  let params = parse_callback_request(&request)?;

  stream
    .write_all(
      b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<!doctype html><html><body><h1>Tinker</h1><p>Codex authorization complete. You can close this window and return to the app.</p></body></html>",
    )
    .await
    .map_err(|error| error.to_string())?;

  let returned_state = params
    .get("state")
    .ok_or_else(|| "Codex OAuth callback did not include state.".to_string())?;
  if returned_state != state {
    return Err("Codex OAuth callback state did not match the request.".to_string());
  }

  let code = params
    .get("code")
    .ok_or_else(|| "Codex OAuth callback did not include a code.".to_string())?;

  Ok((code.clone(), redirect_uri))
}

#[tauri::command]
pub async fn codex_oauth_flow() -> Result<String, String> {
  let state = random_url_safe(24);
  let verifier = random_url_safe(48);
  let challenge = pkce_challenge(&verifier);
  let (code, redirect_uri) = read_authorization_code(&state, &challenge).await?;

  let token = reqwest::Client::new()
    .post(format!("{OPENAI_OAUTH_ISSUER}/oauth/token"))
    .header("Content-Type", "application/x-www-form-urlencoded")
    .form(&[
      ("grant_type", "authorization_code".to_string()),
      ("code", code),
      ("redirect_uri", redirect_uri),
      ("client_id", OPENAI_OAUTH_CLIENT_ID.to_string()),
      ("code_verifier", verifier),
    ])
    .send()
    .await
    .map_err(|error| error.to_string())?
    .error_for_status()
    .map_err(|error| error.to_string())?
    .json::<CodexTokenResponse>()
    .await
    .map_err(|error| error.to_string())?;

  // TODO(codex-oauth): widen the command return type to include refresh token and
  // expiry metadata so the renderer can persist the full OAuth credential.
  Ok(token.access_token)
}
